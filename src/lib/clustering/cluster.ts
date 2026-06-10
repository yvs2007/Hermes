import { cosineSim } from "../reuse-pure";
import {
  getAllRecentClusterIds,
  getArticleEntities,
  getClusterEmbeddings,
  getClusterEntities,
  getSetting,
  insertCluster,
  setArticleEntities,
  updateArticleCluster,
  updateClusterTimestamp,
} from "../db/queries";
import {
  entitiesFromStored,
  entityOverlap,
  extractEntities,
  type ExtractedEntities,
} from "./entities";

// ─── Tunables (all overridable via settings) ────────────────────────────────
//
// `ATTACH_THRESHOLD` is the cosine-similarity floor for the primary
// embedding-based match. Lowered from the old 0.82 → 0.74 because, on the
// 19-source corpus, real same-story matches typically sit in 0.70-0.80 and
// the old threshold was creating singleton clusters at ~93% of articles.
// The entity-overlap second pass below catches anything that legitimately
// lands lower than the cosine floor.
const DEFAULT_ATTACH_THRESHOLD = 0.74;
const DEFAULT_RECENT_WINDOW_HOURS = 24;

// Hard floors so a misconfigured setting can't collapse the whole corpus
// into one cluster.
const MIN_ATTACH_THRESHOLD = 0.55;

function readNumber(key: string, fallback: number, min?: number): number {
  const raw = getSetting(key);
  if (raw === null) return fallback;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v)) return fallback;
  if (min !== undefined && v < min) return min;
  return v;
}

function getAttachThreshold(): number {
  return readNumber("cluster_attach_threshold", DEFAULT_ATTACH_THRESHOLD, MIN_ATTACH_THRESHOLD);
}

function getRecentWindowHours(): number {
  const v = readNumber("cluster_recent_window_hours", DEFAULT_RECENT_WINDOW_HOURS, 1);
  return Math.min(v, 24 * 14); // hard cap at 14 days
}

interface RecentCluster {
  id: string;
  canonical_title: string;
  centroid: number[];
}

function getRecentClusters(): RecentCluster[] {
  const cutoff = new Date(
    Date.now() - getRecentWindowHours() * 3600 * 1000,
  ).toISOString();
  const clusters = getAllRecentClusterIds(cutoff);
  const out: RecentCluster[] = [];
  for (const c of clusters) {
    const embeddings = getClusterEmbeddings(c.id);
    if (embeddings.length === 0) continue;
    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);
    for (const v of embeddings) {
      for (let i = 0; i < dim; i++) centroid[i] += v[i];
    }
    for (let i = 0; i < dim; i++) centroid[i] /= embeddings.length;
    out.push({ id: c.id, canonical_title: c.canonical_title, centroid });
  }
  return out;
}

export interface AttachResult {
  clusterId: string;
  attached: boolean;
  similarity: number;
  matchedBy: "cosine" | "entity" | null;
}

/**
 * Two-pass clustering:
 *
 *   1. Cosine similarity of the article embedding vs each recent cluster's
 *      centroid. If best ≥ `cluster_attach_threshold`, attach.
 *   2. Entity-overlap fallback: extract tickers + proper-noun entities from
 *      the article, intersect with each recent cluster's union of entities.
 *      One shared ticker OR two shared proper nouns is enough.
 *
 *   3. Otherwise start a new singleton cluster.
 *
 * The article's extracted entities are always persisted (regardless of which
 * pass attached it), so subsequent articles can match the cluster via the
 * entity pass.
 */
export function attachToCluster(
  articleId: string,
  embedding: number[],
  fallbackTitle: string,
  articleText: string,
): AttachResult {
  const recent = getRecentClusters();

  // ─── Pass 1: cosine ─────────────────────────────────────────────────
  let best: { id: string; sim: number } | null = null;
  for (const c of recent) {
    const sim = cosineSim(c.centroid, embedding);
    if (!best || sim > best.sim) best = { id: c.id, sim };
  }
  const threshold = getAttachThreshold();

  // Always extract entities — used either for the second pass below OR to
  // enrich a cluster we just attached via cosine.
  const myEntities: ExtractedEntities = extractEntities(articleText);
  setArticleEntities(articleId, myEntities.all);

  if (best && best.sim >= threshold) {
    updateArticleCluster(articleId, best.id);
    updateClusterTimestamp(best.id);
    return {
      clusterId: best.id,
      attached: true,
      similarity: best.sim,
      matchedBy: "cosine",
    };
  }

  // ─── Pass 2: entity overlap ─────────────────────────────────────────
  if (myEntities.all.length > 0) {
    let entityBest: { id: string; tickerOverlap: number; properOverlap: number } | null = null;
    for (const c of recent) {
      const clusterEntities = entitiesFromStored(getClusterEntities(c.id));
      const ov = entityOverlap(myEntities, clusterEntities);
      if (!ov.merge) continue;
      // Prefer the cluster with the most overlap.
      const score = ov.tickerOverlap * 10 + ov.properOverlap;
      if (
        !entityBest ||
        score >
          entityBest.tickerOverlap * 10 + entityBest.properOverlap
      ) {
        entityBest = { id: c.id, ...ov };
      }
    }
    if (entityBest) {
      updateArticleCluster(articleId, entityBest.id);
      updateClusterTimestamp(entityBest.id);
      return {
        clusterId: entityBest.id,
        attached: true,
        similarity: best?.sim ?? 0,
        matchedBy: "entity",
      };
    }
  }

  // ─── Pass 3: new cluster ────────────────────────────────────────────
  const newId = insertCluster(fallbackTitle);
  updateArticleCluster(articleId, newId);
  return {
    clusterId: newId,
    attached: false,
    similarity: best?.sim ?? 0,
    matchedBy: null,
  };
}

/**
 * Compute and persist entities for an article that has none yet. Returns
 * the extracted set so the caller can use it without an extra DB read.
 * Used by the backfill_entities CLI to populate the column for the existing
 * ~1k pre-v3 articles.
 */
export function backfillArticleEntities(
  articleId: string,
  articleText: string,
): ExtractedEntities {
  const existing = getArticleEntities(articleId);
  if (existing.length > 0) {
    return entitiesFromStored(existing);
  }
  const ents = extractEntities(articleText);
  setArticleEntities(articleId, ents.all);
  return ents;
}
