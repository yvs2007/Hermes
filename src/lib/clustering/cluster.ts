import { cosineSim } from "../reuse-pure";
import {
  getAllRecentClusterIds,
  getClusterEmbeddings,
  insertCluster,
  updateArticleCluster,
  updateClusterTimestamp,
} from "../db/queries";

const ATTACH_THRESHOLD = 0.82;
const RECENT_WINDOW_HOURS = 24;

interface RecentCluster {
  id: string;
  canonical_title: string;
  centroid: number[];
}

function getRecentClusters(): RecentCluster[] {
  const cutoff = new Date(Date.now() - RECENT_WINDOW_HOURS * 3600 * 1000).toISOString();
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
}

export function attachToCluster(
  articleId: string,
  embedding: number[],
  fallbackTitle: string,
): AttachResult {
  const recent = getRecentClusters();
  let best: { id: string; sim: number } | null = null;
  for (const c of recent) {
    const sim = cosineSim(c.centroid, embedding);
    if (!best || sim > best.sim) best = { id: c.id, sim };
  }
  if (best && best.sim >= ATTACH_THRESHOLD) {
    updateArticleCluster(articleId, best.id);
    updateClusterTimestamp(best.id);
    return { clusterId: best.id, attached: true, similarity: best.sim };
  }
  const newId = insertCluster(fallbackTitle);
  updateArticleCluster(articleId, newId);
  return { clusterId: newId, attached: false, similarity: best?.sim ?? 0 };
}
