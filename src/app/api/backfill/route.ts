import { NextResponse, type NextRequest } from "next/server";
import { backfillStatus, runBackfill } from "@/lib/pipeline/backfill";

/**
 * Historical backfill of compiled_stories.
 *
 * GET  — { remaining, minArticles, batchSize } — how many clusters still
 *        have no compiled_story at the current minArticles threshold.
 * POST — runs ONE batch. Body (all optional):
 *        { batchSize?: number; minArticles?: number }
 *        Returns the synthesis stats and how many clusters remain after.
 *
 * To drain the whole backlog, call POST repeatedly (or rely on the
 * auto-pipeline appending a small batch to each cycle).
 */

// Synthesis is LLM-bound; allow up to 5 minutes per batch. Vercel hobby tier
// is more restrictive — if deploying there, lower batchSize accordingly.
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true, ...backfillStatus() });
}

export async function POST(req: NextRequest) {
  let body: { batchSize?: number; minArticles?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — use settings/defaults
  }

  const stats = await runBackfill({
    batchSize: body.batchSize,
    minArticles: body.minArticles,
  });
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
