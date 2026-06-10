import { randomUUID } from "crypto";
import {
  type ClusterRow,
  getArticlesByCluster,
  insertCompiledStory,
} from "@/lib/db/queries";
import { synthesizeWithProvider, embedWithProvider } from "@/lib/llm/provider";
import { validateSynthesis } from "@/lib/postprocess";
import { slugifyTitle } from "@/lib/slug";
import { resolveSource } from "@/lib/source-whitelist";
import type { ArticleInput } from "@/lib/llm/types";

export type SynthesizeOutcome =
  | { status: "synthesized"; storyId: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

/**
 * Synthesize a single cluster end-to-end. Pulls articles, calls the LLM
 * provider, validates, embeds the headline, persists a compiled_story.
 *
 * Called by both runFrontPage (recent clusters with the regenerate guard)
 * and runBackfill (historical clusters that have never been synthesized).
 */
export async function synthesizeCluster(
  cluster: ClusterRow,
  sourceMode: "topic" | "links" | "headline" | "compare" = "topic",
): Promise<SynthesizeOutcome> {
  const articleRows = getArticlesByCluster(cluster.id);
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
  if (articles.length === 0) {
    return { status: "skipped", reason: "no whitelisted articles" };
  }

  try {
    const { provider, response } = await synthesizeWithProvider(
      cluster.canonical_title,
      articles,
      { mode: sourceMode },
    );

    const validation = validateSynthesis(
      response,
      articles,
      new Set(articles.map((a) => a.domain)),
    );
    if (!validation.ok) {
      return { status: "error", error: validation.failures.join("; ") };
    }

    let headlineEmbedding: number[] | null = null;
    try {
      headlineEmbedding = await embedWithProvider(
        `${response.headline}\n\n${response.deck ?? ""}`,
      );
    } catch (e) {
      // Embedding failure is non-fatal — the story still persists.
      console.warn(`[synthesize-cluster] headline embed failed: ${(e as Error).message}`);
    }

    // Local LLMs occasionally omit array fields. Validator already allows
    // missing arrays, so coalesce here before hitting the NOT NULL columns
    // (source_domains and the *_attributions JSON columns).
    const sourceDomains =
      response.sourceDomains && response.sourceDomains.length > 0
        ? response.sourceDomains
        : Array.from(new Set(articles.map((a) => a.domain)));

    const storyId = insertCompiledStory({
      slug: slugifyTitle(response.headline, randomUUID()),
      topicClusterId: cluster.id,
      headline: response.headline,
      deck: response.deck,
      body: response.body,
      sourceDomains,
      claimAttributions: response.claimAttributions ?? [],
      disagreements: response.disagreements ?? [],
      singleSourceClaims: response.singleSourceClaims ?? [],
      marketImpacts: response.marketImpacts ?? [],
      sourceMode,
      llmProvider: provider.name,
      modelVersion: provider.modelVersion,
      confidence: response.confidence ?? 0,
      notes: response.notes ?? null,
      headlineEmbedding,
    });
    return { status: "synthesized", storyId };
  } catch (e) {
    return { status: "error", error: (e as Error).message };
  }
}
