/**
 * Hermes — Source Whitelist
 *
 * The canonical TypeScript constant that mirrors the `sources` table seed.
 * Both files MUST stay in sync — this constant is used at build time (e.g.
 * for compile-mode source pickers) and the table is used at runtime by edge
 * functions.
 *
 * Editorial source-of-truth: SOURCE_WHITELIST.md (in the design-doc repo).
 */

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

export interface WhitelistedSource {
  domain: string;
  aliases: string[];
  displayName: string;
  category: SourceCategory;
  biasBaseline: BiasRating;
  credibilityBaseline: number;
  factualReporting: FactualLevel;
  rssFeeds: string[];
  notes?: string;
}

export const SOURCE_WHITELIST: readonly WhitelistedSource[] = [
  // ----- Major Wires -----
  {
    domain: "apnews.com",
    aliases: [],
    displayName: "Associated Press",
    category: "wire",
    biasBaseline: "center",
    credibilityBaseline: 95,
    factualReporting: "very-high",
    rssFeeds: [
      "https://feeds.apnews.com/rss/apf-topnews",
      "https://feeds.apnews.com/rss/apf-business",
      "https://feeds.apnews.com/rss/apf-technology",
      "https://feeds.apnews.com/rss/apf-science",
    ],
  },
  {
    domain: "reuters.com",
    aliases: ["reutersagency.com"],
    displayName: "Reuters",
    category: "wire",
    biasBaseline: "center",
    credibilityBaseline: 95,
    factualReporting: "very-high",
    rssFeeds: [
      "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
      "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best",
      "https://www.reutersagency.com/feed/?best-topics=tech&post_type=best",
      "https://www.reutersagency.com/feed/?best-topics=energy&post_type=best",
    ],
  },
  {
    domain: "afp.com",
    aliases: [],
    displayName: "Agence France-Presse",
    category: "wire",
    biasBaseline: "center",
    credibilityBaseline: 90,
    factualReporting: "very-high",
    rssFeeds: ["https://www.afp.com/en/feed"],
  },
  {
    domain: "bbc.com",
    aliases: ["bbc.co.uk"],
    displayName: "BBC News",
    category: "wire",
    biasBaseline: "center",
    credibilityBaseline: 90,
    factualReporting: "high",
    rssFeeds: [
      "http://feeds.bbci.co.uk/news/world/rss.xml",
      "http://feeds.bbci.co.uk/news/business/rss.xml",
      "http://feeds.bbci.co.uk/news/technology/rss.xml",
      "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    ],
  },

  // ----- US National -----
  {
    domain: "nytimes.com",
    aliases: [],
    displayName: "The New York Times",
    category: "us-national",
    biasBaseline: "center-left",
    credibilityBaseline: 88,
    factualReporting: "high",
    rssFeeds: [
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    ],
    notes: "Paywalled. Use public excerpts; link to original.",
  },
  {
    domain: "washingtonpost.com",
    aliases: [],
    displayName: "The Washington Post",
    category: "us-national",
    biasBaseline: "center-left",
    credibilityBaseline: 88,
    factualReporting: "high",
    rssFeeds: [
      "http://feeds.washingtonpost.com/rss/world",
      "http://feeds.washingtonpost.com/rss/business",
      "http://feeds.washingtonpost.com/rss/national",
    ],
    notes: "Paywalled. Use public excerpts; link to original.",
  },
  {
    domain: "npr.org",
    aliases: [],
    displayName: "NPR",
    category: "us-national",
    biasBaseline: "center-left",
    credibilityBaseline: 90,
    factualReporting: "very-high",
    rssFeeds: [
      "https://feeds.npr.org/1001/rss.xml",
      "https://feeds.npr.org/1006/rss.xml",
      "https://feeds.npr.org/1019/rss.xml",
    ],
  },
  {
    domain: "wsj.com",
    aliases: [],
    displayName: "The Wall Street Journal",
    category: "us-national",
    biasBaseline: "center-right",
    credibilityBaseline: 88,
    factualReporting: "high",
    rssFeeds: [
      "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
      "https://feeds.a.dj.com/rss/RSSWSJD.xml",
      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    ],
    notes: "Paywalled. Use public excerpts; link to original.",
  },
  {
    domain: "usatoday.com",
    aliases: [],
    displayName: "USA Today",
    category: "us-national",
    biasBaseline: "center",
    credibilityBaseline: 85,
    factualReporting: "high",
    rssFeeds: ["http://rssfeeds.usatoday.com/UsatodaycomNation-TopStories"],
  },

  // ----- International -----
  {
    domain: "theguardian.com",
    aliases: [],
    displayName: "The Guardian",
    category: "international",
    biasBaseline: "center-left",
    credibilityBaseline: 85,
    factualReporting: "high",
    rssFeeds: [
      "https://www.theguardian.com/world/rss",
      "https://www.theguardian.com/business/rss",
    ],
  },
  {
    domain: "aljazeera.com",
    aliases: [],
    displayName: "Al Jazeera English",
    category: "international",
    biasBaseline: "center-left",
    credibilityBaseline: 80,
    factualReporting: "mostly-factual",
    rssFeeds: ["https://www.aljazeera.com/xml/rss/all.xml"],
    notes: "English service only.",
  },
  {
    domain: "dw.com",
    aliases: [],
    displayName: "Deutsche Welle",
    category: "international",
    biasBaseline: "center",
    credibilityBaseline: 88,
    factualReporting: "high",
    rssFeeds: ["https://rss.dw.com/rdf/rss-en-all"],
  },
  {
    domain: "france24.com",
    aliases: [],
    displayName: "France 24",
    category: "international",
    biasBaseline: "center",
    credibilityBaseline: 85,
    factualReporting: "high",
    rssFeeds: ["https://www.france24.com/en/rss"],
  },
  {
    domain: "nhk.or.jp",
    aliases: ["www3.nhk.or.jp"],
    displayName: "NHK World",
    category: "international",
    biasBaseline: "center",
    credibilityBaseline: 88,
    factualReporting: "high",
    rssFeeds: ["https://www3.nhk.or.jp/nhkworld/en/news/feeds/"],
  },

  // ----- Business -----
  {
    domain: "bloomberg.com",
    aliases: [],
    displayName: "Bloomberg",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 88,
    factualReporting: "high",
    rssFeeds: [
      "https://feeds.bloomberg.com/markets/news.rss",
      "https://feeds.bloomberg.com/technology/news.rss",
    ],
    notes: "Paywalled. Use public excerpts; link to original.",
  },
  {
    domain: "ft.com",
    aliases: [],
    displayName: "Financial Times",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 90,
    factualReporting: "very-high",
    rssFeeds: ["https://www.ft.com/?format=rss"],
    notes: "Paywalled. RSS available with subscription.",
  },
  {
    domain: "cnbc.com",
    aliases: [],
    displayName: "CNBC",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 83,
    factualReporting: "mostly-factual",
    rssFeeds: [
      "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
      "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069",
      "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
    ],
  },
  {
    domain: "forbes.com",
    aliases: [],
    displayName: "Forbes",
    category: "business",
    biasBaseline: "center-right",
    credibilityBaseline: 78,
    factualReporting: "mostly-factual",
    rssFeeds: ["https://www.forbes.com/business/feed/"],
    notes:
      "Staff reporting only. Reject Contributor URLs containing /sites/ at ingestion.",
  },
  {
    domain: "businessinsider.com",
    aliases: [],
    displayName: "Business Insider",
    category: "business",
    biasBaseline: "center-left",
    credibilityBaseline: 78,
    factualReporting: "mostly-factual",
    rssFeeds: ["https://feeds.businessinsider.com/custom/all"],
  },
  {
    domain: "marketwatch.com",
    aliases: [],
    displayName: "MarketWatch",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 82,
    factualReporting: "high",
    rssFeeds: [
      "http://feeds.marketwatch.com/marketwatch/topstories",
      "http://feeds.marketwatch.com/marketwatch/marketpulse",
    ],
  },
  {
    domain: "finance.yahoo.com",
    aliases: ["yahoo.com"],
    displayName: "Yahoo Finance",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 78,
    factualReporting: "mostly-factual",
    rssFeeds: [
      "https://finance.yahoo.com/news/rssindex",
    ],
  },
  {
    domain: "seekingalpha.com",
    aliases: [],
    displayName: "Seeking Alpha",
    category: "business",
    biasBaseline: "center-right",
    credibilityBaseline: 72,
    factualReporting: "mostly-factual",
    rssFeeds: ["https://seekingalpha.com/market_currents.xml"],
    notes: "Market currents feed (news flashes). Analysis articles are opinion.",
  },
  {
    domain: "barrons.com",
    aliases: [],
    displayName: "Barron's",
    category: "business",
    biasBaseline: "center-right",
    credibilityBaseline: 85,
    factualReporting: "high",
    rssFeeds: ["https://www.barrons.com/feed"],
    notes: "Paywalled. Use public excerpts; link to original.",
  },
  {
    domain: "thestreet.com",
    aliases: [],
    displayName: "TheStreet",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 75,
    factualReporting: "mostly-factual",
    rssFeeds: ["https://www.thestreet.com/.rss/full/"],
  },
  {
    domain: "investing.com",
    aliases: [],
    displayName: "Investing.com",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 75,
    factualReporting: "mostly-factual",
    rssFeeds: ["https://www.investing.com/rss/news.rss"],
  },
  {
    domain: "economist.com",
    aliases: [],
    displayName: "The Economist",
    category: "business",
    biasBaseline: "center",
    credibilityBaseline: 90,
    factualReporting: "very-high",
    rssFeeds: [
      "https://www.economist.com/finance-and-economics/rss.xml",
      "https://www.economist.com/business/rss.xml",
    ],
    notes: "Paywalled. Use public excerpts; link to original.",
  },
  {
    domain: "scmp.com",
    aliases: [],
    displayName: "South China Morning Post",
    category: "international",
    biasBaseline: "center",
    credibilityBaseline: 80,
    factualReporting: "high",
    rssFeeds: ["https://www.scmp.com/rss/91/feed"],
    notes: "Asia/China markets perspective.",
  },
] as const;

const DOMAIN_INDEX: ReadonlyMap<string, WhitelistedSource> = (() => {
  const map = new Map<string, WhitelistedSource>();
  for (const src of SOURCE_WHITELIST) {
    map.set(src.domain.toLowerCase(), src);
    for (const alias of src.aliases) {
      map.set(alias.toLowerCase(), src);
    }
  }
  return map;
})();

export function resolveSource(hostnameOrUrl: string): WhitelistedSource | null {
  let host = hostnameOrUrl.trim().toLowerCase();
  try {
    const u = new URL(host.includes("://") ? host : `https://${host}`);
    host = u.hostname;
  } catch {
    return null;
  }
  if (host.startsWith("www.")) host = host.slice(4);

  const direct = DOMAIN_INDEX.get(host);
  if (direct) return direct;

  for (const [key, src] of DOMAIN_INDEX) {
    if (host === key || host.endsWith("." + key)) return src;
  }
  return null;
}

export function isWhitelisted(url: string): boolean {
  return resolveSource(url) !== null;
}

export function isForbesContributor(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith("forbes.com") && u.pathname.includes("/sites/");
  } catch {
    return false;
  }
}

export function passesIngestionGate(url: string): {
  ok: boolean;
  source: WhitelistedSource | null;
  reason?: string;
} {
  const source = resolveSource(url);
  if (!source) return { ok: false, source: null, reason: "not-whitelisted" };
  if (isForbesContributor(url))
    return { ok: false, source, reason: "forbes-contributor-excluded" };
  return { ok: true, source };
}

export function getSourceByDomain(domain: string): WhitelistedSource | null {
  return DOMAIN_INDEX.get(domain.toLowerCase()) ?? null;
}
