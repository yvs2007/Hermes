import { NextResponse, type NextRequest } from "next/server";
import { getSetting, setSetting } from "@/lib/db/queries";
import { runIngest } from "@/lib/pipeline/ingest";
import { runFrontPage, readCadenceConfig } from "@/lib/pipeline/front-page";
import { runBackfill, backfillStatus } from "@/lib/pipeline/backfill";

/**
 * Auto-pipeline: ingest RSS → synthesize fresh clusters → drain a slice of
 * the historical backlog. One call per cron tick.
 *
 * GET  — current cadence config + last run stats + backfill status
 * POST — runs one cycle: ingest + front-page synthesis + small backfill batch
 * PUT  — update settings (enabled, intervalMinutes, storiesPerSection,
 *        recentClusterHours, backfillPerCycle, backfillMinArticles)
 */

export const maxDuration = 300;

const DEFAULT_BACKFILL_PER_CYCLE = 5;
const MAX_BACKFILL_PER_CYCLE = 50;

function readBackfillPerCycle(): number {
  const raw = getSetting("auto_pipeline_backfill_per_cycle");
  if (raw === null) return DEFAULT_BACKFILL_PER_CYCLE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_BACKFILL_PER_CYCLE;
  return Math.min(parsed, MAX_BACKFILL_PER_CYCLE);
}

export async function GET() {
  const enabled = getSetting("auto_pipeline_enabled") ?? "false";
  const interval = getSetting("auto_pipeline_interval") ?? "5";
  const lastRun = getSetting("auto_pipeline_last_run") ?? null;
  const lastStats = getSetting("auto_pipeline_last_stats") ?? null;
  const cadence = readCadenceConfig();
  const backfill = backfillStatus();

  return NextResponse.json({
    ok: true,
    enabled: enabled === "true",
    intervalMinutes: parseInt(interval, 10),
    storiesPerSection: cadence.storiesPerSection,
    recentClusterHours: cadence.recentClusterHours,
    backfillPerCycle: readBackfillPerCycle(),
    backfillRemaining: backfill.remaining,
    backfillMinArticles: backfill.minArticles,
    lastRun,
    lastStats: lastStats ? JSON.parse(lastStats) : null,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body.enabled === "boolean") {
      setSetting("auto_pipeline_enabled", String(body.enabled));
    }
    if (typeof body.intervalMinutes === "number" && body.intervalMinutes >= 1) {
      setSetting(
        "auto_pipeline_interval",
        String(Math.min(body.intervalMinutes, 60)),
      );
    }
    if (typeof body.storiesPerSection === "number" && body.storiesPerSection > 0) {
      setSetting(
        "front_page_stories_per_section",
        String(Math.min(Math.floor(body.storiesPerSection), 100)),
      );
    }
    if (typeof body.recentClusterHours === "number" && body.recentClusterHours > 0) {
      setSetting(
        "front_page_recent_cluster_hours",
        String(Math.min(Math.floor(body.recentClusterHours), 24 * 30)),
      );
    }
    if (typeof body.backfillPerCycle === "number" && body.backfillPerCycle >= 0) {
      setSetting(
        "auto_pipeline_backfill_per_cycle",
        String(Math.min(Math.floor(body.backfillPerCycle), MAX_BACKFILL_PER_CYCLE)),
      );
    }
    if (typeof body.backfillMinArticles === "number" && body.backfillMinArticles >= 1) {
      setSetting(
        "backfill_min_articles",
        String(Math.floor(body.backfillMinArticles)),
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}

export async function POST() {
  const pipeline = {
    ingest: null as unknown,
    synthesis: null as unknown,
    backfill: null as unknown,
  };
  const errors: string[] = [];

  // Step 1: Ingest fresh articles from RSS
  try {
    pipeline.ingest = await runIngest();
  } catch (e) {
    errors.push(`ingest: ${(e as Error).message}`);
  }

  // Step 2: Run front-page synthesis on new/updated clusters
  try {
    pipeline.synthesis = await runFrontPage();
  } catch (e) {
    errors.push(`synthesis: ${(e as Error).message}`);
  }

  // Step 3: Drain a slice of the historical backlog. This is what eventually
  // produces a useful Plutus corpus over a week of running — every 5-minute
  // tick chips ~N clusters off the unsynthesized pile.
  const backfillBatch = readBackfillPerCycle();
  if (backfillBatch > 0) {
    try {
      pipeline.backfill = await runBackfill({ batchSize: backfillBatch });
    } catch (e) {
      errors.push(`backfill: ${(e as Error).message}`);
    }
  }

  const stats = { pipeline, errors, ranAt: new Date().toISOString() };

  try {
    setSetting("auto_pipeline_last_run", stats.ranAt);
    setSetting("auto_pipeline_last_stats", JSON.stringify(stats));
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: errors.length === 0, stats });
}
