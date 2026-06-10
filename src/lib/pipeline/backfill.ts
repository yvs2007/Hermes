import {
  countUnsynthesizedClusters,
  getUnsynthesizedClusters,
  getSetting,
} from "@/lib/db/queries";
import { synthesizeCluster } from "@/lib/pipeline/synthesize-cluster";

/**
 * Backfill — synthesize topic clusters that have never had a compiled_story
 * produced from them.
 *
 * Why this exists
 * ---------------
 * `runFrontPage` only walks clusters with activity in the last
 * `front_page_recent_cluster_hours` window AND applies the regeneration
 * guard from `reuse-pure.ts`. That's correct for the live "what's on the
 * front page right now?" surface, but it means clusters that are slightly
 * older than the window never get synthesized at all — they just sit in
 * `topic_clusters` with `compiled_story IS NULL` forever.
 *
 * Backfill drains that backlog. Clusters are processed in article-count
 * DESC order so multi-source ones (the ones any sane trading strategy
 * actually wants) drain first.
 */

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;
const DEFAULT_MIN_ARTICLES = 1;

export interface BackfillStats {
  batchSize: number;
  minArticles: number;
  attempted: number;
  synthesized: number;
  skipped: number;
  errors: string[];
  remainingAfter: number;
}

export interface BackfillOpts {
  batchSize?: number;
  minArticles?: number;
}

function clampBatchSize(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_BATCH_SIZE;
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(Math.floor(requested), MAX_BATCH_SIZE);
}

function readBatchSizeFromSetting(): number {
  const raw = getSetting("backfill_batch_size");
  if (raw === null) return DEFAULT_BATCH_SIZE;
  const parsed = Number.parseInt(raw, 10);
  return clampBatchSize(parsed);
}

function readMinArticlesFromSetting(): number {
  const raw = getSetting("backfill_min_articles");
  if (raw === null) return DEFAULT_MIN_ARTICLES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MIN_ARTICLES;
  return parsed;
}

export async function runBackfill(opts: BackfillOpts = {}): Promise<BackfillStats> {
  const batchSize = clampBatchSize(opts.batchSize ?? readBatchSizeFromSetting());
  const minArticles = opts.minArticles ?? readMinArticlesFromSetting();

  const clusters = getUnsynthesizedClusters(batchSize, minArticles);

  const stats: BackfillStats = {
    batchSize,
    minArticles,
    attempted: clusters.length,
    synthesized: 0,
    skipped: 0,
    errors: [],
    remainingAfter: 0,
  };

  for (const c of clusters) {
    const outcome = await synthesizeCluster(c, "topic");
    if (outcome.status === "synthesized") {
      stats.synthesized++;
    } else if (outcome.status === "skipped") {
      stats.skipped++;
    } else {
      stats.errors.push(`cluster ${c.id}: ${outcome.error}`);
    }
  }

  stats.remainingAfter = countUnsynthesizedClusters(minArticles);
  return stats;
}

export function backfillStatus(): {
  remaining: number;
  minArticles: number;
  batchSize: number;
} {
  const minArticles = readMinArticlesFromSetting();
  return {
    remaining: countUnsynthesizedClusters(minArticles),
    minArticles,
    batchSize: readBatchSizeFromSetting(),
  };
}
