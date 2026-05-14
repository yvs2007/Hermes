import { randomUUID } from "crypto";
import {
  getRecentClusters as getRecentClusterRows,
  getLatestStoryForCluster,
  getArticlesByCluster,
  countNewArticlesInCluster,
  insertCompiledStory,
} from "@/lib/db/queries";
import { synthesizeWithProvider, embedWithProvider } from "@/lib/llm/provider";
import { validateSynthesis } from "@/lib/postprocess";
import { shouldRegenerate } from "@/lib/reuse-pure";
import { slugifyTitle } from "@/lib/slug";
import { resolveSource } from "@/lib/source-whitelist";
import type { ArticleInput } from "@/lib/llm/types";

const SECTIONS = ["world", "us", "business", "markets", "tech", "culture"];
const STORIES_PER_SECTION = 4;
const RECENT_CLUSTER_HOURS = 24;

export interface FrontPageStats {
  sectionsTried: number;
  clustersWalked: number;
  skippedFresh: number;
  freshSyntheses: number;
  errors: string[];
}

export async function runFrontPage(): Promise<FrontPageStats> {
  const stats: FrontPageStats = {
    sectionsTried: 0,
    clustersWalked: 0,
    skippedFresh: 0,
    freshSyntheses: 0,
    errors: [],
  };

  const recentSince = new Date(
    Date.now() - RECENT_CLUSTER_HOURS * 3600 * 1000,
  ).toISOString();

  for (const section of SECTIONS) {
    stats.sectionsTried++;
    const clusters = getRecentClusterRows(section, recentSince, STORIES_PER_SECTION);

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

      const articleRows = getArticlesByCluster(c.id);
      const articles: ArticleInput[] = [];
      for (const row of articleRows) {
        const src = resolveSource(row.url);
        if (!src) continue;
        articles.push({
          id: row.id,
          url: row.url,
          domain: row.source_domain,
          displayName: src.displayName,
          title: row.title,
          author: row.author,
          publishedAt: row.published_at,
          body: row.content,
        });
      }
      if (articles.length === 0) continue;

      try {
        const { provider, response } = await synthesizeWithProvider(
          c.canonical_title,
          articles,
          { mode: "topic" },
        );
        const validation = validateSynthesis(
          response,
          articles,
          new Set(articles.map((a) => a.domain)),
        );
        if (!validation.ok) {
          stats.errors.push(`cluster ${c.id}: ${validation.failures.join("; ")}`);
          continue;
        }

        let headlineEmbedding: number[] | null = null;
        try {
          headlineEmbedding = await embedWithProvider(
            `${response.headline}\n\n${response.deck ?? ""}`,
          );
        } catch (e) {
          console.warn(`[front-page] headline embed failed: ${(e as Error).message}`);
        }

        insertCompiledStory({
          slug: slugifyTitle(response.headline, randomUUID()),
          topicClusterId: c.id,
          headline: response.headline,
          deck: response.deck,
          body: response.body,
          sourceDomains: response.sourceDomains,
          claimAttributions: response.claimAttributions,
          disagreements: response.disagreements,
          singleSourceClaims: response.singleSourceClaims ?? [],
          marketImpacts: response.marketImpacts ?? [],
          sourceMode: "topic",
          llmProvider: provider.name,
          modelVersion: provider.modelVersion,
          confidence: response.confidence,
          notes: response.notes ?? null,
          headlineEmbedding,
        });
        stats.freshSyntheses++;
      } catch (e) {
        stats.errors.push(`cluster ${c.id}: ${(e as Error).message}`);
      }
    }
  }

  return stats;
}
