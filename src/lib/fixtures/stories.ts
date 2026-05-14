/**
 * Fixture compiled stories used to render the front page and a fully
 * populated `/topic/[slug]` view in Phase 1, before any real ingestion or
 * synthesis is wired up. The shape mirrors the production `CompiledStory`
 * type 1:1 so the same renderer can swap to real data in Phase 3.
 */

import type { CompiledStory, StoryCardData } from "@/lib/types/story";
import { getSourceByDomain, type WhitelistedSource } from "@/lib/source-whitelist";
import type { SourceRef } from "@/lib/types/source";

function ref(domain: string, articleUrl?: string): SourceRef {
  const s = getSourceByDomain(domain) as WhitelistedSource;
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

export const LEAD_STORY: CompiledStory = {
  id: "fxt-lead-001",
  slug: "central-banks-diverge-fed-holds-ecb-cut",
  section: "markets",
  headline: "Central Banks Diverge as Fed Holds Rates, ECB Signals Cut",
  deck: "A widening transatlantic gap takes shape as policymakers weigh stubborn U.S. core inflation against a softening European outlook — with markets reading the same data five different ways.",
  byline:
    "Compiled by Hermes from Reuters, Associated Press, Bloomberg, Financial Times, BBC News, and The Wall Street Journal",
  refreshedAt: "2026-05-03T14:22:00Z",
  mode: "topic",
  body: [
    {
      kind: "paragraph",
      paragraph: {
        dropCap: true,
        tokens: [
          {
            kind: "text",
            text: "The Federal Reserve held its benchmark interest rate steady on Wednesday, citing persistent core inflation and a labor market that has cooled less than officials expected",
          },
          { kind: "cite", domains: ["reuters.com", "apnews.com", "wsj.com"] },
          {
            kind: "text",
            text: '. Chair Jerome Powell told reporters that the committee was "in no hurry" to begin cutting rates, language that several outlets characterized as a hardening of the central bank\'s recent posture',
          },
          { kind: "cite", domains: ["bloomberg.com", "ft.com"] },
          { kind: "text", text: "." },
        ],
      },
    },
    {
      kind: "paragraph",
      paragraph: {
        tokens: [
          {
            kind: "text",
            text: "Markets reacted within minutes. U.S. Treasury yields rose across the curve and the dollar strengthened against most major currencies",
          },
          { kind: "cite", domains: ["bloomberg.com", "wsj.com"] },
          { kind: "text", text: ". Equities slipped before paring losses into the close" },
          { kind: "cite", domains: ["reuters.com"] },
          { kind: "text", text: "." },
        ],
      },
    },
    {
      kind: "paragraph",
      paragraph: {
        tokens: [
          {
            kind: "text",
            text: 'Across the Atlantic, the European Central Bank\'s chief economist signaled in a separate appearance that euro-area conditions were "consistent with a path toward easing," in remarks that Reuters and the BBC interpreted as the clearest indication yet of an imminent cut',
          },
          { kind: "cite", domains: ["reuters.com", "bbc.com"] },
          {
            kind: "text",
            text: ". The Financial Times noted that the ECB's tone has shifted noticeably since its last policy meeting",
          },
          { kind: "cite", domains: ["ft.com"] },
          { kind: "text", text: "." },
        ],
      },
    },
    {
      kind: "disagreement",
      block: {
        label: "Sources Disagree",
        description:
          "Outlets differ on the magnitude of Wednesday's hawkish signal from the Federal Reserve.",
        bullets: [
          {
            sources: ["Reuters", "AP"],
            text: "describe Powell's remarks as a continuation of existing guidance, not a meaningful shift.",
          },
          {
            sources: ["Bloomberg", "FT"],
            text: "characterize the same remarks as a notable hardening of the committee's posture, citing the absence of any explicit reference to upcoming cuts.",
          },
          {
            sources: ["WSJ"],
            text: 'splits the difference, framing it as a "tactical" change in language without a change in policy.',
          },
        ],
      },
    },
    {
      kind: "paragraph",
      paragraph: {
        tokens: [
          {
            kind: "text",
            text: 'Economists quoted across the coverage offered competing readings. One Bloomberg-cited analyst argued the Fed was preparing markets for a "higher for longer" stance through the second half of the year',
          },
          { kind: "cite", domains: ["bloomberg.com"] },
          {
            kind: "text",
            text: ". Reuters cited two former Fed officials who said current data did not yet warrant a meaningful change in trajectory",
          },
          { kind: "cite", domains: ["reuters.com"] },
          { kind: "text", text: "." },
        ],
      },
    },
    {
      kind: "paragraph",
      paragraph: {
        trailingNote:
          "This claim appears in only one source and has not yet been corroborated elsewhere.",
        tokens: [
          {
            kind: "text",
            text: "In Asia, the Bank of Japan is widely expected to keep rates unchanged at its meeting later this week, though the Financial Times reported that internal discussions about ending negative-rate-era guidance are advancing faster than previously assumed",
          },
          { kind: "cite", domains: ["ft.com"], single: true },
          { kind: "text", text: "." },
        ],
      },
    },
    {
      kind: "paragraph",
      paragraph: {
        tokens: [
          {
            kind: "text",
            text: "Currency markets are pricing the divergence directly: the euro fell against the dollar to its lowest level in three months, and futures markets now imply a higher probability of a June cut from the ECB than from the Fed",
          },
          { kind: "cite", domains: ["bloomberg.com", "ft.com", "wsj.com"] },
          { kind: "text", text: "." },
        ],
      },
    },
    {
      kind: "paragraph",
      paragraph: {
        tokens: [
          {
            kind: "text",
            text: "What every outlet agreed on: the next inflation print, due next week, will be the single most consequential data release of the quarter",
          },
          {
            kind: "cite",
            domains: [
              "reuters.com",
              "apnews.com",
              "bloomberg.com",
              "ft.com",
              "wsj.com",
              "bbc.com",
            ],
          },
          { kind: "text", text: "." },
        ],
      },
    },
  ],
  sources: [
    ref("reuters.com"),
    ref("apnews.com"),
    ref("bloomberg.com"),
    ref("ft.com"),
    ref("bbc.com"),
    ref("wsj.com"),
  ],
  claimAttributions: [
    {
      claimText: "Federal Reserve held its benchmark interest rate steady on Wednesday",
      attributedTo: ["reuters.com", "apnews.com", "wsj.com"],
    },
    {
      claimText: 'Powell told reporters the committee was "in no hurry" to begin cutting rates',
      attributedTo: ["bloomberg.com", "ft.com"],
    },
    {
      claimText: "U.S. Treasury yields rose across the curve and the dollar strengthened",
      attributedTo: ["bloomberg.com", "wsj.com"],
    },
    {
      claimText: "BoJ internal discussions about ending negative-rate-era guidance are advancing",
      attributedTo: ["ft.com"],
    },
  ],
  marketImpacts: [
    {
      ticker: "^DJI",
      company: "Dow Jones Industrial Average",
      score: -12,
      direction: "negative" as const,
      reasoning: "Fed holding rates steady with hawkish language pressures equities as higher-for-longer expectations reduce earnings multiples.",
    },
    {
      ticker: "TLT",
      company: "iShares 20+ Year Treasury Bond ETF",
      score: -18,
      direction: "negative" as const,
      reasoning: "Rising Treasury yields across the curve directly hurt long-duration bond prices.",
    },
    {
      ticker: "UUP",
      company: "Invesco DB US Dollar Index Bullish Fund",
      score: 15,
      direction: "positive" as const,
      reasoning: "Dollar strengthened against major currencies as rate differential widens vs ECB.",
    },
    {
      ticker: "FXE",
      company: "Invesco CurrencyShares Euro Trust",
      score: -14,
      direction: "negative" as const,
      reasoning: "Euro fell to three-month low on diverging Fed/ECB policy expectations.",
    },
  ],
};

export const SIDE_STORIES: StoryCardData[] = [
  {
    slug: "g7-foreign-ministers-tokyo-sanctions",
    section: "world",
    headline: "G7 Foreign Ministers Meet in Tokyo Amid Strain Over Sanctions Package",
    blurb:
      "Coverage from Reuters, AFP, BBC, NHK, and DW points to broad agreement on objectives but visible tension over implementation timelines.",
    sourceNames: ["Reuters", "AFP", "BBC", "NHK", "DW"],
  },
  {
    slug: "ai-lab-copyright-suit-publishing-coalition",
    section: "tech",
    headline: "Major AI Lab Faces New Copyright Suit From Publishing Coalition",
    blurb:
      "Outlets diverge on the strength of the plaintiffs' case; two sources note the suit largely mirrors prior unsuccessful actions.",
    sourceNames: ["NYT", "Reuters", "FT", "Business Insider"],
  },
  {
    slug: "house-passes-stopgap-funding-bill",
    section: "us",
    headline: "House Passes Stopgap Funding Bill With Narrow Bipartisan Margin",
    blurb:
      "Wire and national outlets agree on the vote count; commentary varies on what the margin signals for upcoming negotiations.",
    sourceNames: ["AP", "Reuters", "NYT", "WaPo", "NPR"],
  },
  {
    slug: "oil-prices-steady-opec-production-plan",
    section: "markets",
    headline: "Oil Prices Steady After OPEC+ Maintains Production Plan",
    blurb:
      "Bloomberg, FT, and CNBC report aligned numbers; differences are limited to which analyst voices each outlet emphasizes.",
    sourceNames: ["Bloomberg", "FT", "CNBC"],
  },
  {
    slug: "museum-returns-artifacts-agreement",
    section: "culture",
    headline: "Major Museum Returns Artifacts in Long-Negotiated Agreement",
    blurb:
      "Only the Guardian and BBC have published on this story; treat as developing — not yet corroborated in the wires.",
    sourceNames: ["Guardian", "BBC"],
    singleSource: true,
  },
];

export const LEAD_CARD: StoryCardData = {
  slug: LEAD_STORY.slug,
  section: LEAD_STORY.section,
  headline: LEAD_STORY.headline,
  blurb: LEAD_STORY.deck,
  sourceNames: LEAD_STORY.sources.map((s) => s.displayName),
};

/** Map of slug → full compiled story. The fixture only fully populates the lead. */
export const COMPILED_STORIES: Record<string, CompiledStory> = {
  [LEAD_STORY.slug]: LEAD_STORY,
};

export function getCompiledStory(slug: string): CompiledStory | null {
  return COMPILED_STORIES[slug] ?? null;
}

export function getStoryCardsForSection(section: string): StoryCardData[] {
  if (section === "all" || !section) return [LEAD_CARD, ...SIDE_STORIES];
  return [LEAD_CARD, ...SIDE_STORIES].filter((c) => c.section === section);
}
