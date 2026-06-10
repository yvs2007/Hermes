import {
  getRecentClusters as getRecentClusterRows,
  getLatestStoryForCluster,
  countNewArticlesInCluster,
  getSetting,
} from "@/lib/db/queries";
import { shouldRegenerate } from "@/lib/reuse-pure";
import { synthesizeCluster } from "@/lib/pipeline/synthesize-cluster";

const SECTIONS = ["world", "us", "business", "markets", "tech", "culture"];

// Defaults — both are overridable via the settings table. The defaults are
// substantially higher than the previous hard-coded 4 / 24 because the
// clusterer currently dumps everything into `section = world` so the per-
// section cap was acting as the real throughput governor.
const DEFAULT_STORIES_PER_SECTION = 20;
const DEFAULT_RECENT_CLUSTER_HOURS = 168; // one week

// Hard ceilings — even a misconfigured setting cannot exceed these.
const MAX_STORIES_PER_SECTION = 100;
const MAX_RECENT_CLUSTER_HOURS = 24 * 30; // 30 days

export interface FrontPageStats {
  sectionsTried: number;
  clustersWalked: number;
  skippedFresh: number;
  freshSyntheses: number;
  storiesPerSection: number;
  recentClusterHours: number;
  errors: string[];
}

function readNumberSetting(key: string, fallback: number, hardCap: number): number {
  const raw = getSetting(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, hardCap);
}

export function readCadenceConfig(): {
  storiesPerSection: number;
  recentClusterHours: number;
} {
  return {
    storiesPerSection: readNumberSetting(
      "front_page_stories_per_section",
      DEFAULT_STORIES_PER_SECTION,
      MAX_STORIES_PER_SECTION,
    ),
    recentClusterHours: readNumberSetting(
      "front_page_recent_cluster_hours",
      DEFAULT_RECENT_CLUSTER_HOURS,
      MAX_RECENT_CLUSTER_HOURS,
    ),
  };
}

export async function runFrontPage(): Promise<FrontPageStats> {
  const { storiesPerSection, recentClusterHours } = readCadenceConfig();

  const stats: FrontPageStats = {
    sectionsTried: 0,
    clustersWalked: 0,
    skippedFresh: 0,
    freshSyntheses: 0,
    storiesPerSection,
    recentClusterHours,
    errors: [],
  };

  const recentSince = new Date(
    Date.now() - recentClusterHours * 3600 * 1000,
  ).toISOString();

  for (const section of SECTIONS) {
    stats.sectionsTried++;
    const clusters = getRecentClusterRows(section, recentSince, storiesPerSection);

    for (const c of clusters) {
      stats.clustersWalked++;

      const existing = getLatestStoryForCluster(c.id);
      if (existing) {
        const refreshedAt = new Date(existing.refreshed_at);
        const newCount = countNewArticlesInCluster(c.id, existing.refreshed_at);
        if (
          !shouldRegenerate({
            refreshedAt,
            newArticleCount: newCount,
            hasAnyNewArticle: newCount > 0,
          })
        ) {
          stats.skippedFresh++;
          continue;
        }
      }

      const outcome = await synthesizeCluster(c, "topic");
      if (outcome.status === "synthesized") {
        stats.freshSyntheses++;
      } else if (outcome.status === "error") {
        stats.errors.push(`cluster ${c.id}: ${outcome.error}`);
      }
      // 'skipped' (no whitelisted articles) is silent — common and not actionable.
    }
  }

  return stats;
}
