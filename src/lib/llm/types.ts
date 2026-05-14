export type SourceCategory = "wire" | "us-national" | "international" | "business";
export type BiasRating =
  | "far-left"
  | "left"
  | "center-left"
  | "center"
  | "center-right"
  | "right"
  | "far-right"
  | "indeterminate";
export type FactualLevel =
  | "very-high"
  | "high"
  | "mostly-factual"
  | "mixed"
  | "low"
  | "very-low";
export type SynthesisMode = "freeform" | "topic" | "links" | "headline" | "compare";

export interface ArticleInput {
  id?: string;
  url: string;
  domain: string;
  displayName: string;
  title: string;
  publishedAt?: string | null;
  author?: string | null;
  body: string;
}

export interface ClaimAttribution {
  claimText: string;
  attributedDomains: string[];
}

export interface Disagreement {
  description: string;
  positions: Array<{ domain: string; position: string }>;
}

export interface SingleSourceClaim {
  claimText: string;
  domain: string;
  reasoning: string;
}

export interface MarketImpact {
  ticker: string;
  company: string;
  score: number;
  direction: "positive" | "negative" | "neutral";
  reasoning: string;
}

export interface SynthesisResponse {
  headline: string;
  deck: string;
  body: string;
  sourceDomains: string[];
  claimAttributions: ClaimAttribution[];
  disagreements: Disagreement[];
  singleSourceClaims: SingleSourceClaim[];
  marketImpacts: MarketImpact[];
  confidence: number;
  notes?: string;
}

export interface SynthOpts {
  mode: SynthesisMode;
  comparedDomains?: string[];
  maxBodyChars?: number;
}

export interface ArticleAnalysis {
  source: {
    domain: string;
    credibilityScore: number;
    biasRating: BiasRating;
    factualReporting: FactualLevel;
    notes: string;
  };
  claims: Array<{
    id: string;
    text: string;
    category: string;
    biasIndicators: { rating: BiasRating; direction: string; explanation: string };
    credibility: { score: number; explanation: string };
    factCheck: {
      status: string;
      summary: string;
      confidence: number;
      counterEvidence?: string;
    };
  }>;
}
