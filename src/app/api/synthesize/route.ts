import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 300; // 5 minutes — thinking models are slow
import { randomUUID } from "crypto";
import {
  getArticleByUrl,
  getRecentArticlesByQuery,
  insertArticle,
  insertCluster,
  insertCompiledStory,
  getCompiledStoryById,
  recordSynthesis,
  type ArticleRow,
} from "@/lib/db/queries";
import { passesIngestionGate, resolveSource } from "@/lib/source-whitelist";
import { extractArticle, sha256 } from "@/lib/ingestion/readability";
import { synthesizeWithProvider, embedWithProvider } from "@/lib/llm/provider";
import { validateSynthesis } from "@/lib/postprocess";
import { slugifyTitle } from "@/lib/slug";
import {
  findReusableStory,
  incrementStoryReusedCount,
  linksHash,
  compareHash,
} from "@/lib/reuse";
import type { ArticleInput, SynthesisMode } from "@/lib/llm/types";

interface SynthesizeRequest {
  mode: SynthesisMode;
  query?: string;
  headline?: string;
  urls?: string[];
  domains?: string[];
}

const RECENT_HOURS = 72;

export async function POST(req: NextRequest) {
  let body: SynthesizeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  try {
    // Reuse check
    const reusable = await findReusableStory({
      mode: body.mode,
      query: body.query ?? body.headline,
      urls: body.urls,
      domains: body.domains,
    });
    if (reusable) {
      try { incrementStoryReusedCount(reusable.id); } catch { /* best-effort */ }
      const story = getCompiledStoryById(reusable.id);
      recordSynthesis({
        queryText: body.query ?? body.headline ?? "",
        sourceMode: body.mode,
        compiledStoryId: reusable.id,
      });
      return NextResponse.json({
        ok: true,
        cached: { hit: true, age_seconds: reusable.ageSeconds },
        story: { id: reusable.id, slug: reusable.slug },
        response: story
          ? {
              headline: story.headline,
              deck: story.deck,
              body: story.body,
              sourceDomains: JSON.parse(story.source_domains),
              claimAttributions: JSON.parse(story.claim_attributions),
              disagreements: JSON.parse(story.disagreements),
              singleSourceClaims: JSON.parse(story.single_source_claims),
              confidence: story.confidence,
              notes: story.notes,
            }
          : null,
      });
    }

    // Assemble articles
    const articles = await assembleArticles(body);
    if (articles.length === 0) {
      return NextResponse.json(
        { error: "no whitelisted articles found for this request" },
        { status: 404 },
      );
    }
    if (articles.length > 8) articles.length = 8;

    const canonicalTitle =
      body.query?.trim() || body.headline?.trim() || articles[0].title;
    const whitelisted = new Set(articles.map((a) => a.domain));

    // Synthesize with retry
    let synthesisResult = await synthesizeWithProvider(canonicalTitle, articles, {
      mode: body.mode,
      comparedDomains: body.domains,
    });

    let validation = validateSynthesis(synthesisResult.response, articles, whitelisted);
    if (!validation.ok) {
      console.warn(
        `[synthesize] validation failed once, retrying: ${validation.failures.join("; ")}`,
      );
      synthesisResult = await synthesizeWithProvider(canonicalTitle, articles, {
        mode: body.mode,
        comparedDomains: body.domains,
      });
      validation = validateSynthesis(synthesisResult.response, articles, whitelisted);
      if (!validation.ok) {
        return NextResponse.json(
          { error: "synthesis failed post-validation", failures: validation.failures },
          { status: 422 },
        );
      }
    }

    const { provider, response: rawResponse } = synthesisResult;

    // Normalize response — local models may use different field names or omit fields
    const response = {
      headline: rawResponse.headline ?? "Untitled",
      deck: rawResponse.deck ?? "",
      body: rawResponse.body ?? "",
      sourceDomains: rawResponse.sourceDomains ?? articles.map((a) => a.domain),
      claimAttributions: rawResponse.claimAttributions ?? [],
      disagreements: rawResponse.disagreements ?? [],
      singleSourceClaims: rawResponse.singleSourceClaims ?? [],
      marketImpacts: rawResponse.marketImpacts ?? [],
      confidence: rawResponse.confidence ?? 0.5,
      notes: rawResponse.notes ?? null,
    };

    // Compute reuse keys
    const hashForRow = await reuseHashForRequest(body);
    let headlineEmbedding: number[] | null = null;
    try {
      headlineEmbedding = await embedWithProvider(
        `${response.headline}\n\n${response.deck ?? ""}`,
      );
    } catch (e) {
      console.warn(`[synthesize] headline embed failed: ${(e as Error).message}`);
    }

    const slug = slugifyTitle(response.headline, randomUUID());
    const clusterId = resolveCluster(articles, canonicalTitle);

    const storyId = insertCompiledStory({
      slug,
      topicClusterId: clusterId,
      headline: response.headline,
      deck: response.deck,
      body: response.body,
      sourceDomains: response.sourceDomains,
      claimAttributions: response.claimAttributions,
      disagreements: response.disagreements,
      singleSourceClaims: response.singleSourceClaims ?? [],
      marketImpacts: response.marketImpacts ?? [],
      sourceMode: body.mode,
      llmProvider: provider.name,
      modelVersion: provider.modelVersion,
      confidence: response.confidence,
      notes: response.notes ?? null,
      linksHash: hashForRow,
      headlineEmbedding,
    });

    recordSynthesis({
      queryText: body.query ?? body.headline ?? "",
      sourceMode: body.mode,
      compiledStoryId: storyId,
    });

    return NextResponse.json({
      ok: true,
      cached: { hit: false, age_seconds: 0 },
      story: { id: storyId, slug },
      response,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function reuseHashForRequest(body: SynthesizeRequest): Promise<string | null> {
  if (body.mode === "links") return body.urls?.length ? await linksHash(body.urls) : null;
  if (body.mode === "compare" && body.query && body.domains?.length) {
    return await compareHash(body.query, body.domains);
  }
  return null;
}

function resolveCluster(articles: ArticleInput[], canonicalTitle: string): string {
  // Find the most common cluster among assembled articles
  const counts = new Map<string, number>();
  for (const a of articles) {
    if (!a.id) continue;
    const row = getArticleByUrl(a.url);
    if (row?.topic_cluster_id) {
      counts.set(row.topic_cluster_id, (counts.get(row.topic_cluster_id) ?? 0) + 1);
    }
  }
  let best: { id: string; n: number } | null = null;
  for (const [id, n] of counts) {
    if (!best || n > best.n) best = { id, n };
  }
  if (best) return best.id;
  return insertCluster(canonicalTitle);
}

async function assembleArticles(req: SynthesizeRequest): Promise<ArticleInput[]> {
  switch (req.mode) {
    case "freeform":
      return assembleFromFreeform(req.query ?? "");
    case "links":
      return assembleFromLinks(req.urls ?? []);
    case "topic":
    case "headline":
    case "compare":
      return assembleFromQuery(
        req.query ?? req.headline ?? "",
        req.mode === "compare" ? (req.domains ?? []) : undefined,
      );
  }
}

/**
 * Freeform assembly: split user query into sub-topics, search each independently,
 * then merge results ensuring coverage across all topics.
 */
function assembleFromFreeform(query: string): ArticleInput[] {
  if (!query.trim()) return [];
  const since = new Date(Date.now() - RECENT_HOURS * 3600 * 1000).toISOString();

  // Split on common conjunctions/comparators to identify sub-topics
  const subTopics = splitIntoSubTopics(query);

  if (subTopics.length <= 1) {
    // Single topic — fall back to standard query assembly
    return assembleFromQuery(query);
  }

  // Search each sub-topic independently
  const perTopic: Map<string, ArticleRow[]> = new Map();
  for (const topic of subTopics) {
    const rows = getRecentArticlesByQuery(topic, since, 20);
    // Also try individual keywords if few results
    if (rows.length < 3 && topic.includes(" ")) {
      const keywords = topic.split(/\s+/).filter((w) => w.length >= 3);
      const seen = new Set(rows.map((r) => r.id));
      for (const kw of keywords) {
        const extra = getRecentArticlesByQuery(kw, since, 15);
        for (const r of extra) {
          if (!seen.has(r.id)) {
            rows.push(r);
            seen.add(r.id);
          }
        }
      }
    }
    perTopic.set(topic, rows);
  }

  // Allocate article slots proportionally across topics (max 10 total for freeform)
  const maxTotal = 10;
  const perTopicLimit = Math.max(2, Math.floor(maxTotal / subTopics.length));
  const allSelected: ArticleRow[] = [];
  const globalSeen = new Set<string>();

  for (const [, rows] of perTopic) {
    // Deduplicate by source within this topic
    const byDomain = new Map<string, ArticleRow>();
    for (const row of rows) {
      if (!globalSeen.has(row.id) && !byDomain.has(row.source_domain)) {
        byDomain.set(row.source_domain, row);
      }
    }
    let added = 0;
    for (const [, row] of byDomain) {
      if (added >= perTopicLimit || allSelected.length >= maxTotal) break;
      allSelected.push(row);
      globalSeen.add(row.id);
      added++;
    }
  }

  // If we still have room, backfill with the full query for cross-topic articles
  if (allSelected.length < maxTotal) {
    const crossRows = getRecentArticlesByQuery(query, since, 15);
    for (const r of crossRows) {
      if (allSelected.length >= maxTotal) break;
      if (!globalSeen.has(r.id)) {
        allSelected.push(r);
        globalSeen.add(r.id);
      }
    }
  }

  const out: ArticleInput[] = [];
  for (const row of allSelected) {
    const src = resolveSource(row.url);
    if (!src) continue;
    out.push({
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
  return out;
}

/** Split a freeform query into sub-topics by conjunctions and comparison words. */
function splitIntoSubTopics(query: string): string[] {
  // Split on: "and", "vs", "versus", "compared to", "compare", "with", "&", ","
  const parts = query
    .split(/\b(?:and|vs\.?|versus|compared?\s+to|compare|with|&)\b|,/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  return parts.length > 0 ? parts : [query.trim()];
}

async function assembleFromLinks(urls: string[]): Promise<ArticleInput[]> {
  const out: ArticleInput[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) continue;
    const gate = passesIngestionGate(url);
    if (!gate.ok || !gate.source) continue;

    const existing = getArticleByUrl(url);
    if (existing) {
      out.push({
        id: existing.id,
        url: existing.url,
        domain: existing.source_domain,
        displayName: gate.source.displayName,
        title: existing.title,
        publishedAt: existing.published_at,
        author: existing.author,
        body: existing.content,
      });
      continue;
    }
    const extracted = await extractArticle(url);
    if (!extracted) continue;
    const hash = sha256(extracted.textContent);
    const articleId = insertArticle({
      url,
      sourceDomain: gate.source.domain,
      title: extracted.title || url,
      author: extracted.byline,
      content: extracted.textContent,
      contentHash: hash,
    });
    out.push({
      id: articleId,
      url,
      domain: gate.source.domain,
      displayName: gate.source.displayName,
      title: extracted.title || url,
      author: extracted.byline,
      body: extracted.textContent,
    });
  }
  return out;
}

function assembleFromQuery(
  query: string,
  filterDomains?: string[],
): ArticleInput[] {
  if (!query.trim()) return [];
  const since = new Date(Date.now() - RECENT_HOURS * 3600 * 1000).toISOString();

  // For broad queries, pull more articles to maximize source diversity.
  // The LLM gets max 8 but we want the BEST 8 from a larger pool,
  // preferring unique sources.
  const fetchLimit = 30;
  const rows = getRecentArticlesByQuery(query, since, fetchLimit, filterDomains);

  // If exact phrase found few results, try individual keywords
  if (rows.length < 4 && query.includes(" ")) {
    const keywords = query.split(/\s+/).filter((w) => w.length >= 3);
    for (const kw of keywords) {
      if (rows.length >= fetchLimit) break;
      const extra = getRecentArticlesByQuery(kw, since, fetchLimit, filterDomains);
      const seen = new Set(rows.map((r) => r.id));
      for (const r of extra) {
        if (!seen.has(r.id)) {
          rows.push(r);
          seen.add(r.id);
        }
      }
    }
  }

  // Deduplicate by source — pick best article per domain, then fill remaining slots
  const byDomain = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byDomain.has(row.source_domain)) byDomain.set(row.source_domain, []);
    byDomain.get(row.source_domain)!.push(row);
  }

  // One article per source first (max diversity), then fill with seconds
  const selected: typeof rows = [];
  for (const [, domainRows] of byDomain) {
    selected.push(domainRows[0]);
  }
  // If still under 8, add second-best articles from sources with multiple hits
  if (selected.length < 8) {
    for (const [, domainRows] of byDomain) {
      if (selected.length >= 8) break;
      for (let i = 1; i < domainRows.length && selected.length < 8; i++) {
        selected.push(domainRows[i]);
      }
    }
  }
  // Cap at 8 for the LLM
  selected.length = Math.min(selected.length, 8);

  const out: ArticleInput[] = [];
  for (const row of selected) {
    const src = resolveSource(row.url);
    if (!src) continue;
    out.push({
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
  return out;
}
