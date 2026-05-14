import { getSourceByDomain } from "@/lib/source-whitelist";
import type {
  CompiledStory,
  StoryCardData,
  StorySection,
} from "@/lib/types/story";
import type { MarketImpact } from "@/lib/llm/types";
import type { SourceRef } from "@/lib/types/source";
import { LEAD_STORY, SIDE_STORIES, getCompiledStory } from "@/lib/fixtures/stories";
import { bodyToBlocks } from "@/lib/stories/body-parser";
import {
  getCompiledStoryBySlug,
  getRecentCompiledStories,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/connection";

function toSourceRef(domain: string, articleUrl?: string): SourceRef | null {
  const s = getSourceByDomain(domain);
  if (!s) return null;
  return {
    domain: s.domain,
    displayName: s.displayName,
    category: s.category,
    bias: s.biasBaseline,
    credibility: s.credibilityBaseline,
    factualReporting: s.factualReporting,
    articleUrl: articleUrl ?? `https://${s.domain}`,
  };
}

/** Find the most recent article URL for each domain in a given cluster */
function getArticleUrlsByDomain(clusterId: string | null, domains: string[]): Map<string, string> {
  const map = new Map<string, string>();
  if (!clusterId && domains.length === 0) return map;

  const db = getDb();
  if (clusterId) {
    const rows = db
      .prepare(
        "SELECT source_domain, url FROM articles WHERE topic_cluster_id = ? ORDER BY ingested_at DESC",
      )
      .all(clusterId) as Array<{ source_domain: string; url: string }>;
    for (const r of rows) {
      if (!map.has(r.source_domain)) map.set(r.source_domain, r.url);
    }
  }

  // For any domains not found via cluster, get the most recent article from that source
  for (const d of domains) {
    if (map.has(d)) continue;
    const row = db
      .prepare("SELECT url FROM articles WHERE source_domain = ? ORDER BY ingested_at DESC LIMIT 1")
      .get(d) as { url: string } | undefined;
    if (row) map.set(d, row.url);
  }
  return map;
}

function inferSection(domains: string[]): StorySection {
  const cats = domains.map((d) => getSourceByDomain(d)?.category);
  if (cats.some((c) => c === "business")) return "business";
  return "world";
}

export async function readCompiledStory(slug: string): Promise<CompiledStory | null> {
  try {
    const data = getCompiledStoryBySlug(slug);
    if (!data) return getCompiledStory(slug);

    const sourceDomains: string[] = JSON.parse(data.source_domains);
    const urlMap = getArticleUrlsByDomain(data.topic_cluster_id, sourceDomains);
    const sourceRefs = sourceDomains
      .map((d: string) => toSourceRef(d, urlMap.get(d)))
      .filter((s): s is SourceRef => Boolean(s));

    return {
      id: data.id,
      slug: data.slug,
      section: inferSection(sourceDomains),
      headline: data.headline,
      deck: data.deck ?? "",
      byline: `Compiled by Hermes from ${sourceRefs.map((s) => s.displayName).join(", ")}`,
      refreshedAt: data.refreshed_at,
      body: bodyToBlocks(data.body),
      sources: sourceRefs,
      claimAttributions: JSON.parse(data.claim_attributions) as CompiledStory["claimAttributions"],
      marketImpacts: JSON.parse(data.market_impacts ?? "[]") as MarketImpact[],
      mode: data.source_mode as CompiledStory["mode"],
      singleSource: sourceRefs.length <= 1,
    };
  } catch {
    return getCompiledStory(slug);
  }
}

export async function readFrontPage(): Promise<{
  lead: CompiledStory;
  side: StoryCardData[];
}> {
  try {
    const rows = getRecentCompiledStories(8);
    if (rows.length === 0) {
      return { lead: LEAD_STORY, side: SIDE_STORIES };
    }
    const [leadRow, ...rest] = rows;
    const lead = (await readCompiledStory(leadRow.slug)) ?? LEAD_STORY;
    const side: StoryCardData[] = rest.map((r) => {
      const domains: string[] = JSON.parse(r.source_domains);
      const sourceNames = domains.map(
        (d: string) => getSourceByDomain(d)?.displayName ?? d,
      );
      return {
        slug: r.slug,
        section: inferSection(domains),
        headline: r.headline,
        blurb: r.deck ?? "",
        sourceNames,
        singleSource: sourceNames.length <= 1,
      };
    });
    return { lead, side: side.length > 0 ? side : SIDE_STORIES };
  } catch {
    return { lead: LEAD_STORY, side: SIDE_STORIES };
  }
}
