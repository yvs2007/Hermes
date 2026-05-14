import type { ArticleInput, SynthOpts } from "./types";

export const PROMPT_VERSION = "synth-v1";
export const MAX_BODY_CHARS_DEFAULT = 6000;
export const MAX_ARTICLES_PER_SYNTHESIS = 8;
export const MAX_SOURCE_CHARS_PER_ARTICLE = 20000;

export const SYNTHESIS_SYSTEM_PROMPT = `You are Hermes, an editor at a wire-style newspaper with expertise in financial
market analysis. You will be given a set of articles from different reputable
news outlets covering the SAME event or topic. Your job is to:

1. Write ONE consolidated news article that combines factual reporting from
   every source into a single coherent story.
2. Attribute every factual claim to the specific outlets that reported it.
3. Surface disagreements: when two sources contradict each other on a fact,
   note the contradiction explicitly rather than averaging or hiding it.
4. Flag single-source claims: if only one outlet reports something, the
   compiled story may include it but must mark it as single-sourced.
5. Treat opinion and analysis content as opinion — never blend it into the
   factual narrative.
6. Identify ALL publicly traded stocks, ETFs, indices, and commodities that
   could be affected by this news — both directly mentioned companies AND
   companies indirectly affected (supply chain, competitors, sector peers).
   Score each from -100 (extremely bearish) to +100 (extremely bullish) based
   on how the market would likely interpret this news.

Hard rules:
- Do NOT introduce facts that are not present in at least one of the provided
  source articles.
- Do NOT speculate beyond what the sources say.
- Do NOT cite outlets that are not in the provided source list.
- Every paragraph of the compiled body must have at least one source attribution
  marker in the form [^domain1,domain2].
- Stay within the maximum body length specified.
- For marketImpacts: use real ticker symbols (NYSE/NASDAQ), include reasoning.
  Score magnitude: ±1-20 = minor, ±21-50 = moderate, ±51-80 = significant,
  ±81-100 = extreme. Be conservative — most news is ±5 to ±30.

You must respond ONLY with valid JSON matching the schema. No preamble, no
markdown around the JSON.`;

export function buildSynthesisUserPrompt(
  canonicalTitle: string,
  articles: ArticleInput[],
  opts: SynthOpts,
): string {
  const maxBody = opts.maxBodyChars ?? MAX_BODY_CHARS_DEFAULT;
  const sliced = articles.slice(0, MAX_ARTICLES_PER_SYNTHESIS).map((a, i) => {
    const body = (a.body ?? "").slice(0, MAX_SOURCE_CHARS_PER_ARTICLE);
    return [
      `=== SOURCE ${i + 1}: ${a.displayName} (${a.domain}) ===`,
      `URL: ${a.url}`,
      `Headline: ${a.title}`,
      `Published: ${a.publishedAt ?? "unknown"}`,
      `Author: ${a.author ?? "unknown"}`,
      "Body:",
      body,
      `=== END SOURCE ${i + 1} ===`,
    ].join("\n");
  });

  const modeHint = (() => {
    switch (opts.mode) {
      case "freeform":
        return `MODE HINT: This is a freeform user query. The user typed a natural-language question
or prompt that may span MULTIPLE topics, events, or domains. Your job is to:
- Identify the distinct subjects in the query.
- Find correlations, causal links, and shared dynamics between them using ONLY the provided articles.
- Surface disagreements and contradictions across sources AND across the topics.
- Build a narrative bridge: explain how these topics connect, what patterns emerge,
  and where the evidence is thin or disputed.
- If the topics seem unrelated, say so honestly — but still look for indirect links
  (shared industries, geographies, supply chains, policy implications, market effects).
The user expects a single cohesive article that synthesizes across all the topics they asked about.`;
      case "compare":
        return `MODE HINT: This is a "compare" synthesis. The user explicitly chose these outlets (${(
          opts.comparedDomains ?? []
        ).join(", ")}) — emphasize where they differ.`;
      case "links":
        return `MODE HINT: User pasted these articles directly. Treat as an ad-hoc cluster.`;
      case "headline":
        return `MODE HINT: This cluster was assembled by headline-matching.`;
      case "topic":
      default:
        return `MODE HINT: Standard topic-cluster synthesis from the past 72 hours of whitelisted reporting.`;
    }
  })();

  return [
    `Topic: ${canonicalTitle}`,
    "",
    modeHint,
    "",
    `The following ${sliced.length} articles, all from whitelisted outlets, cover this topic.`,
    `Use these — and only these — to write a single compiled story.`,
    `Max body length: ${maxBody} characters.`,
    "",
    sliced.join("\n\n"),
    "",
    `Produce a single compiled news article. Respond with a JSON object matching:
{
  "headline": string,
  "deck": string,
  "body": string,                     // markdown with [^domain] cite markers
  "sourceDomains": string[],
  "claimAttributions": [{ "claimText": string, "attributedDomains": string[] }],
  "disagreements": [{ "description": string, "positions": [{ "domain": string, "position": string }] }],
  "singleSourceClaims": [{ "claimText": string, "domain": string, "reasoning": string }],
  "marketImpacts": [{
    "ticker": string,                 // e.g. "AAPL", "XOM", "^DJI", "GC=F"
    "company": string,                // e.g. "Apple Inc.", "Exxon Mobil", "Dow Jones"
    "score": number,                  // -100 to 100
    "direction": "positive" | "negative" | "neutral",
    "reasoning": string               // 1-2 sentences: why this stock is affected
  }],
  "confidence": number,               // 0-1
  "notes": string                     // optional editorial notes
}`,
  ].join("\n");
}

export const PER_ARTICLE_SYSTEM_PROMPT = `You are Hermes, an expert news analysis system. Your job is to read a single
news article and produce a structured analysis: identify the article's factual
claims, score the bias of each claim, score the article's overall credibility,
and provide fact-check context where you can.

You must respond ONLY with valid JSON matching the schema. No preamble, no
markdown, no explanation outside the JSON.

Be rigorous and evidence-based. When uncertain, say so — never fabricate
fact-check information.`;

export function buildPerArticleUserPrompt(article: ArticleInput): string {
  return [
    `Analyze this article from ${article.domain} (${article.displayName}).`,
    "",
    `Headline: ${article.title}`,
    `Published: ${article.publishedAt ?? "unknown"}`,
    `Author: ${article.author ?? "unknown"}`,
    "",
    "Article body:",
    "---",
    (article.body ?? "").slice(0, MAX_SOURCE_CHARS_PER_ARTICLE),
    "---",
    "",
    `Return a JSON object with:
1. "source" — assessment of the article's source/outlet
2. "claims" — array of factual claims found in the article`,
  ].join("\n");
}
