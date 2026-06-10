import { NextResponse, type NextRequest } from "next/server";
import { runClusterMerge } from "@/lib/pipeline/cluster-merge";

/**
 * Retroactive cluster merging via entity overlap.
 *
 * POST body (all optional):
 *   { timeWindowHours?: number,    // default 72
 *     backfillEntities?: boolean,  // default true — fill entities[] for any
 *                                  //   articles ingested before the v3 schema
 *     dryRun?: boolean }           // default false — report counts only
 *
 * Long-running (entity backfill is O(N) over ~1k articles, merge step is
 * roughly linear in the number of shared-entity pairs). 10-minute ceiling.
 */
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  let body: {
    timeWindowHours?: number;
    backfillEntities?: boolean;
    dryRun?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body fine */
  }
  const stats = await runClusterMerge({
    timeWindowHours: body.timeWindowHours,
    backfillEntities: body.backfillEntities,
    dryRun: body.dryRun,
  });
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
