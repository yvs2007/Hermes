export interface Article {
  id: string;
  url: string;
  sourceDomain: string;
  title: string;
  author?: string | null;
  publishedAt: string;
  content: string;
  contentHash: string;
  topicClusterId?: string | null;
  ingestedAt: string;
}

export interface ArticleClaim {
  text: string;
  /** Domains of outlets that published this claim (1+). */
  attributedTo: string[];
}

export interface ArticleAnalysis {
  articleId: string;
  bias: string;
  credibility: number;
  uniqueContributions: string[];
  claims: ArticleClaim[];
}
