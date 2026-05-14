import { NextResponse, type NextRequest } from "next/server";
import { getSetting, setSetting } from "@/lib/db/queries";
import { runIngest } from "@/lib/pipeline/ingest";
import { runFrontPage } from "@/lib/pipeline/front-page";

/**
 * Auto-pipeline: ingest RSS → synthesize front-page clusters in one call.
 *
 * GET  — returns current auto-pipeline status (enabled, interval, last run stats)
 * POST — runs one cycle: ingest + front-page synthesis
 * PUT  — update settings (enabled, interval_minutes)
 */

export async function GET() {
  const enabled = getSetting("auto_pipeline_enabled") ?? "false";
  const interval = getSetting("auto_pipeline_interval") ?? "5";
  const lastRun = getSetting("auto_pipeline_last_run") ?? null;
  const lastStats = getSetting("auto_pipeline_last_stats") ?? null;

  return NextResponse.json({
    ok: true,
    enabled: enabled === "true",
    intervalMinutes: parseInt(interval, 10),
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}

export const maxDuration = 300;

export async function POST() {
  const pipeline = { ingest: null as unknown, synthesis: null as unknown };
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

  const stats = { pipeline, errors, ranAt: new Date().toISOString() };

  // Persist last run info
  try {
    setSetting("auto_pipeline_last_run", stats.ranAt);
    setSetting("auto_pipeline_last_stats", JSON.stringify(stats));
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: errors.length === 0, stats });
}
