import { describe, expect, it } from "vitest";
import { validateSynthesis } from "../../supabase/functions/_shared/postprocess.ts";
import type {
  ArticleInput,
  SynthesisResponse,
} from "../../supabase/functions/_shared/types.ts";

const articles: ArticleInput[] = [
  {
    url: "https://www.reuters.com/x",
    domain: "reuters.com",
    displayName: "Reuters",
    title: "Fed holds rates",
    body: "The Federal Reserve held its benchmark interest rate steady on Wednesday, citing persistent core inflation.",
  },
  {
    url: "https://apnews.com/x",
    domain: "apnews.com",
    displayName: "AP",
    title: "Fed steady",
    body: "Powell told reporters the committee was in no hurry to begin cutting rates.",
  },
];

const whitelisted = new Set(["reuters.com", "apnews.com"]);

function baseResponse(overrides: Partial<SynthesisResponse> = {}): SynthesisResponse {
  return {
    headline: "Fed Holds Rates",
    deck: "deck",
    body:
      "The Federal Reserve held its benchmark interest rate steady on Wednesday[^reuters,ap].\n\nPowell told reporters the committee was in no hurry to begin cutting rates[^ap].",
    sourceDomains: ["reuters.com", "apnews.com"],
    claimAttributions: [
      {
        claimText: "Federal Reserve held its benchmark interest rate steady",
        attributedDomains: ["reuters.com"],
      },
      {
        claimText: "Powell told reporters the committee was in no hurry",
        attributedDomains: ["apnews.com"],
      },
    ],
    disagreements: [],
    singleSourceClaims: [],
    confidence: 0.9,
    ...overrides,
  };
}

describe("validateSynthesis", () => {
  it("passes a well-formed response", () => {
    const r = validateSynthesis(baseResponse(), articles, whitelisted);
    expect(r.ok).toBe(true);
    expect(r.failures).toHaveLength(0);
  });

  it("flags paragraphs missing citation markers", () => {
    const r = validateSynthesis(
      baseResponse({
        body:
          "The Federal Reserve held its benchmark interest rate steady on Wednesday[^reuters,ap].\n\nThis paragraph has no citation at all.",
      }),
      articles,
      whitelisted,
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("paragraph 2"))).toBe(true);
  });

  it("flags claims not present in any source article", () => {
    const r = validateSynthesis(
      baseResponse({
        claimAttributions: [
          {
            claimText: "Aliens have landed at the Federal Reserve building today",
            attributedDomains: ["reuters.com"],
          },
        ],
      }),
      articles,
      whitelisted,
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("not grounded"))).toBe(true);
  });

  it("flags cited domains outside the whitelist", () => {
    const r = validateSynthesis(
      baseResponse({ sourceDomains: ["reuters.com", "infowars.com"] }),
      articles,
      whitelisted,
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("not on whitelist"))).toBe(true);
  });

  it("flags cited domains not in this synthesis's article set", () => {
    const r = validateSynthesis(
      baseResponse({ sourceDomains: ["reuters.com", "apnews.com", "bbc.com"] }),
      articles,
      new Set(["reuters.com", "apnews.com", "bbc.com"]),
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("article set"))).toBe(true);
  });
});
