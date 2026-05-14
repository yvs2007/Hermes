import type { SourceRef } from "@/lib/types/source";
import type { MarketImpact } from "@/lib/llm/types";

export type StorySection = "world" | "us" | "business" | "markets" | "tech" | "culture";

/**
 * A single token of inline content inside a body paragraph: either plain text
 * or a citation marker that references one or more source domains.
 */
export type BodyToken =
  | { kind: "text"; text: string }
  | {
      kind: "cite";
      /** Source domains cited at this position. */
      domains: string[];
      /**
       * True when this claim appears in only one source — UI flags it visually.
       */
      single?: boolean;
    };

export interface BodyParagraph {
  tokens: BodyToken[];
  /** When true, render the lede drop cap. */
  dropCap?: boolean;
  /** Inline italic note rendered immediately after the paragraph. */
  trailingNote?: string;
}

export interface DisagreementBullet {
  /** Source display names that hold this position. */
  sources: string[];
  /** What those sources reported. */
  text: string;
}

export interface DisagreementBlock {
  label?: string;
  description: string;
  bullets: DisagreementBullet[];
}

/**
 * The body is a flat list of either paragraphs or disagreement callouts so the
 * renderer can interleave them inside the multi-column layout (callouts span
 * across columns).
 */
export type BodyBlock =
  | { kind: "paragraph"; paragraph: BodyParagraph }
  | { kind: "disagreement"; block: DisagreementBlock };

export interface ClaimAttribution {
  /**
   * The text of the claim as it appears in the synthesized body. Used by the
   * post-validation step to fuzzy-match against source-article text.
   */
  claimText: string;
  attributedTo: string[];
}

export interface CompiledStory {
  id: string;
  slug: string;
  section: StorySection;
  headline: string;
  deck: string;
  /** Compiled-by byline, e.g. "Compiled by Hermes from Reuters, AP and 4 others". */
  byline: string;
  /** ISO timestamp of when the synthesis last refreshed. */
  refreshedAt: string;
  body: BodyBlock[];
  sources: SourceRef[];
  claimAttributions: ClaimAttribution[];
  /** Stocks, ETFs, indices, and commodities affected by this news. */
  marketImpacts: MarketImpact[];
  /** Mode that produced the story (topic / links / headline / compare). */
  mode?: "topic" | "links" | "headline" | "compare";
  /**
   * If true, the story is drawn from a single outlet — UI surfaces this
   * prominently as a "developing / not yet corroborated" badge.
   */
  singleSource?: boolean;
}

export interface StoryCardData {
  slug: string;
  section: StorySection;
  headline: string;
  blurb: string;
  /** Display names of the sources contributing to the story. */
  sourceNames: string[];
  singleSource?: boolean;
}
