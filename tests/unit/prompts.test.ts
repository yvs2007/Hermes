import { describe, expect, it } from "vitest";
import {
  MAX_ARTICLES_PER_SYNTHESIS,
  buildPerArticleUserPrompt,
  buildSynthesisUserPrompt,
  PROMPT_VERSION,
  SYNTHESIS_SYSTEM_PROMPT,
} from "../../supabase/functions/_shared/llm/prompts.ts";
import type { ArticleInput } from "../../supabase/functions/_shared/types.ts";

const sample: ArticleInput = {
  url: "https://www.reuters.com/x",
  domain: "reuters.com",
  displayName: "Reuters",
  title: "Fed holds rates",
  publishedAt: "2026-05-03T14:00:00Z",
  body: "The Federal Reserve held rates steady on Wednesday.",
};

describe("synthesis prompt", () => {
  it("includes every article's source header in order", () => {
    const articles: ArticleInput[] = Array.from({ length: 3 }, (_, i) => ({
      ...sample,
      url: `https://example.com/${i}`,
      title: `Article ${i + 1}`,
    }));
    const prompt = buildSynthesisUserPrompt("Fed Rate Decision", articles, {
      mode: "topic",
    });
    for (let i = 1; i <= 3; i++) {
      expect(prompt).toContain(`=== SOURCE ${i}: Reuters (reuters.com) ===`);
      expect(prompt).toContain(`Headline: Article ${i}`);
    }
  });

  it("caps the number of source blocks at MAX_ARTICLES_PER_SYNTHESIS", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...sample,
      url: `https://example.com/${i}`,
      title: `Article ${i + 1}`,
    }));
    const prompt = buildSynthesisUserPrompt("Topic", many, { mode: "topic" });
    const sourceMatches = prompt.match(/=== SOURCE \d+:/g) ?? [];
    expect(sourceMatches.length).toBe(MAX_ARTICLES_PER_SYNTHESIS);
  });

  it("emits a compare-mode hint when mode is compare", () => {
    const prompt = buildSynthesisUserPrompt("Topic", [sample], {
      mode: "compare",
      comparedDomains: ["reuters.com", "apnews.com"],
    });
    expect(prompt).toContain('"compare" synthesis');
    expect(prompt).toContain("reuters.com, apnews.com");
  });

  it("system prompt forbids inventing facts", () => {
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("Do NOT introduce facts");
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("Do NOT cite outlets");
  });

  it("PROMPT_VERSION is set", () => {
    expect(PROMPT_VERSION).toMatch(/^synth-v\d+$/);
  });
});

describe("per-article prompt", () => {
  it("includes the outlet display name and domain", () => {
    const p = buildPerArticleUserPrompt(sample);
    expect(p).toContain("from reuters.com (Reuters)");
    expect(p).toContain('1. "source"');
    expect(p).toContain('2. "claims"');
  });
});
