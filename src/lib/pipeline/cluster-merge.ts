import { getDb } from "@/lib/db/connection";
import {
  type ClusterRow,
  getArticlesByCluster,
  getArticlesMissingEntities,
  setArticleEntities,
} from "@/lib/db/queries";
import { entitiesFromStored, entityOverlap, extractEntities } from "@/lib/clustering/entities";

/**
 * Retroactive cluster merger.
 *
 * For the existing corpus (773 singleton clusters out of 834), the entity-
 * overlap second pass only helps newly-ingested articles. To unlock the
 * already-ingested singletons, we walk pairs of clusters and merge any whose
 * articles share ≥1 ticker or ≥2 proper nouns AND fall within a time window.
 *
 * Strategy:
 *   1. Backfill entities for any articles that don't have them.
 *   2. Build a per-cluster entity union.
 *   3. Group clusters by anchor entities (cheap O(N) bucketisation).
 *   4. Within each bucket, pairwise check entityOverlap and merge.
 *
 * Merging is destructive: the smaller cluster's articles get re-pointed at
 * the larger cluster's id, and the smaller cluster row is deleted. The
 * canonical_title of the survivor is updated to the larger cluster's title
 * (we keep the older / first-created title to remain stable across reruns).
 */

const TIME_WINDOW_HOURS = 72;
const BACKFILL_BATCH = 200;

// Refuse to merge into any cluster that already has ≥ this many articles.
// The transitive nature of the merge means a single hot bucket (say a
// frequently-cited country name) can chain together hundreds of unrelated
// stories. Capping at 15 stops the runaway before it leaves the "this is
// reasonably one story" zone — real news clusters rarely exceed that.
const MAX_MERGE_TARGET_SIZE = 15;

export interface MergeStats {
  entitiesBackfilled: number;
  clustersScanned: number;
  pairsConsidered: number;
  merges: number;
  beforeClusterCount: number;
  afterClusterCount: number;
  errors: string[];
}

interface ClusterSnapshot {
  id: string;
  canonical_title: string;
  last_updated_at: string;
  articleCount: number;
  entities: string[]; // merged ($ticker | "proper noun") list
}

function snapshotAllClusters(): ClusterSnapshot[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tc.id, tc.canonical_title, tc.last_updated_at,
              (SELECT count(*) FROM articles a WHERE a.topic_cluster_id = tc.id) AS article_count
         FROM topic_clusters tc
        ORDER BY tc.last_updated_at DESC`,
    )
    .all() as Array<ClusterRow & { article_count: number }>;
  const out: ClusterSnapshot[] = [];
  for (const r of rows) {
    const articles = getArticlesByCluster(r.id, 50);
    const set = new Set<string>();
    for (const a of articles) {
      try {
        for (const e of JSON.parse(a.entities) as string[]) set.add(e);
      } catch {
        // skip malformed
      }
    }
    out.push({
      id: r.id,
      canonical_title: r.canonical_title,
      last_updated_at: r.last_updated_at,
      articleCount: r.article_count,
      entities: Array.from(set),
    });
  }
  return out;
}

function withinTimeWindow(a: string, b: string, windowHours: number): boolean {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) <= windowHours * 3600 * 1000;
}

function mergeClusterInto(survivorId: string, victimId: string): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE articles SET topic_cluster_id = ? WHERE topic_cluster_id = ?")
      .run(survivorId, victimId);
    // Stories already produced for the victim cluster get re-pointed too —
    // they still describe the same topic, just under the survivor's id.
    db.prepare(
      "UPDATE compiled_stories SET topic_cluster_id = ? WHERE topic_cluster_id = ?",
    ).run(survivorId, victimId);
    db.prepare("DELETE FROM topic_clusters WHERE id = ?").run(victimId);
    db.prepare(
      "UPDATE topic_clusters SET last_updated_at = datetime('now') WHERE id = ?",
    ).run(survivorId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export async function runClusterMerge(opts: {
  timeWindowHours?: number;
  backfillEntities?: boolean;
  dryRun?: boolean;
} = {}): Promise<MergeStats> {
  const timeWindowHours = opts.timeWindowHours ?? TIME_WINDOW_HOURS;
  const backfill = opts.backfillEntities ?? true;
  const dryRun = opts.dryRun ?? false;

  const stats: MergeStats = {
    entitiesBackfilled: 0,
    clustersScanned: 0,
    pairsConsidered: 0,
    merges: 0,
    beforeClusterCount: 0,
    afterClusterCount: 0,
    errors: [],
  };

  if (backfill) {
    while (true) {
      const batch = getArticlesMissingEntities(BACKFILL_BATCH);
      if (batch.length === 0) break;
      for (const a of batch) {
        try {
          const text = `${a.title}\n\n${a.content.slice(0, 1500)}`;
          const ents = extractEntities(text);
          setArticleEntities(a.id, ents.all);
          stats.entitiesBackfilled++;
        } catch (e) {
          stats.errors.push(`entity extract ${a.id}: ${(e as Error).message}`);
        }
      }
      if (batch.length < BACKFILL_BATCH) break;
    }
  }

  const snapshots = snapshotAllClusters();
  stats.beforeClusterCount = snapshots.length;
  stats.clustersScanned = snapshots.length;

  // Bucket by every anchor entity — clusters in the same bucket are pairwise
  // candidates. This keeps total comparisons near linear instead of O(N²)
  // over all clusters when most clusters share zero entities.
  const buckets = new Map<string, ClusterSnapshot[]>();
  for (const s of snapshots) {
    for (const e of s.entities) {
      if (!buckets.has(e)) buckets.set(e, []);
      buckets.get(e)!.push(s);
    }
  }

  // Survivor map: clusterId -> the cluster id it has been merged into.
  const merged = new Map<string, string>();
  function resolve(id: string): string {
    let cur = id;
    while (merged.has(cur)) cur = merged.get(cur)!;
    return cur;
  }

  // Live article counts as merges accrete. Used by the max-size guard.
  const liveCount = new Map<string, number>();
  for (const s of snapshots) liveCount.set(s.id, s.articleCount);

  for (const candidates of buckets.values()) {
    if (candidates.length < 2) continue;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        stats.pairsConsidered++;
        if (a.id === b.id) continue;
        const aResolved = resolve(a.id);
        const bResolved = resolve(b.id);
        if (aResolved === bResolved) continue;
        if (!withinTimeWindow(a.last_updated_at, b.last_updated_at, timeWindowHours)) {
          continue;
        }
        const ov = entityOverlap(
          entitiesFromStored(a.entities),
          entitiesFromStored(b.entities),
        );
        if (!ov.merge) continue;

        // Survivor = whichever has more articles, ties broken by older id.
        const aLive = liveCount.get(aResolved) ?? a.articleCount;
        const bLive = liveCount.get(bResolved) ?? b.articleCount;
        const survivor = aLive >= bLive ? aResolved : bResolved;
        const victim = survivor === aResolved ? bResolved : aResolved;
        const victimLive = victim === aResolved ? aLive : bLive;
        const survivorLive = survivor === aResolved ? aLive : bLive;
        if (survivorLive + victimLive > MAX_MERGE_TARGET_SIZE) {
          // Skipping protects against transitive over-merges that chain
          // unrelated stories together via a shared generic entity.
          continue;
        }
        try {
          if (!dryRun) mergeClusterInto(survivor, victim);
          merged.set(victim, survivor);
          liveCount.set(survivor, survivorLive + victimLive);
          stats.merges++;
        } catch (e) {
          stats.errors.push(`merge ${victim}→${survivor}: ${(e as Error).message}`);
        }
      }
    }
  }

  stats.afterClusterCount = stats.beforeClusterCount - stats.merges;
  return stats;
}
