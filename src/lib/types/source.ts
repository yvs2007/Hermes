import type { BiasRating, FactualLevel, SourceCategory } from "@/lib/source-whitelist";

export type { BiasRating, FactualLevel, SourceCategory };

export interface SourceRef {
  domain: string;
  displayName: string;
  category: SourceCategory;
  bias: BiasRating;
  credibility: number;
  factualReporting: FactualLevel;
  /** Direct link to the original article in this outlet, when available. */
  articleUrl?: string;
}
