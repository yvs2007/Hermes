/**
 * Lightweight regex-based entity extractor for the clustering second pass.
 *
 * What it extracts (in priority order):
 *  1. Cashtags     — `$AAPL`, `$XOM` etc. Always a ticker, very high precision.
 *  2. Tickers      — UPPERCASE 1-5 letter tokens that appear in a financial
 *                    context (next to "Inc", "Corp", a parenthesised company
 *                    name, or a dollar sign). Mid-precision.
 *  3. Proper nouns — Title-case multi-word sequences ("Spirit Airlines",
 *                    "Walt Disney Company", "Bank of America"). The bulk of
 *                    real merges happen here because most news doesn't use
 *                    ticker symbols inline.
 *
 * The output is a deduplicated list of canonical strings (lowercased for
 * proper nouns, uppercased for tickers). The clustering layer uses set
 * intersection to score overlap between articles.
 *
 * Deliberately conservative: a stop list keeps common all-caps tokens
 * ("CEO", "USA", "GDP") out of the ticker bucket, and stop words trim the
 * head/tail of proper-noun phrases ("The White House" → "White House").
 */

const TICKER_RE = /\$([A-Z]{1,5})\b/g;
// Connectors allowed inside a proper-noun phrase. Deliberately excludes
// "and" / "the": company names like "Spirit Airlines and Walt Disney" would
// otherwise glue two distinct entities into one unrecoverable blob.
// "Johnson & Johnson" and "Procter & Gamble" already use "&" in practice.
const PROPER_NOUN_RE = /\b((?:[A-Z][a-z][a-zA-Z]*(?:\s+(?:of|de|du|la|le|von|van|al)\s+|\s+)){1,4}[A-Z][a-z][a-zA-Z]*)\b/g;

// All-caps acronyms that look like tickers but aren't tradable instruments.
const TICKER_STOP = new Set([
  "USA", "US", "UK", "EU", "UN", "EU3", "OPEC", "NATO", "ASEAN", "OECD",
  "CEO", "CFO", "CTO", "COO", "CIO", "CMO", "VP", "SVP", "EVP",
  "GDP", "GNP", "CPI", "PPI", "IPO", "ETF", "TLDR", "FAQ", "AI",
  "NYSE", "NASDAQ", "SEC", "FED", "FOMC", "FDA", "FTC", "DOJ", "IRS",
  "DC", "LA", "NY", "SF", "NYC", "LON", "TYO", "HK", "EU27",
  "AP", "BBC", "CNN", "ABC", "NBC", "CBS", "FOX", "AFP",
  "Q1", "Q2", "Q3", "Q4", "H1", "H2", "FY", "YOY", "QOQ",
  "WSJ", "NYT", "FT",
]);

// Common proper-noun-phrase noise. Headlines start with these a lot.
const PHRASE_STOP_TOKENS = new Set([
  "the", "a", "an", "this", "that", "these", "those",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
]);

// Phrases that are technically Title Case but carry no entity signal.
// We also exclude every country / major political entity name here — these
// co-occur across unrelated news constantly and would otherwise produce
// transitive over-merges (e.g. "US sanctions Iran" links to "US economy
// grew 3%" links to "US-China trade deal" → all one mega-cluster).
const PHRASE_DENYLIST = new Set([
  "white house", "supreme court", "wall street", "main street",
  "north america", "south america", "north korea", "south korea",
  "middle east", "far east", "european union", "united nations",
  "new york times", "wall street journal",
  // Countries that get name-checked in everything.
  "united states", "united kingdom", "great britain",
  // Generic compass / hemispheric labels caught as 2+ token phrases.
  "western world", "eastern bloc",
]);

// Tickers that are really ALL-CAPS acronyms picked up by the naked-ticker
// regex. These bucket-anchor far too many unrelated stories — block them
// from being treated as ticker entities entirely.
const TICKER_PSEUDO_BLOCK = new Set([
  "DOGE", "GOP", "DNC", "BJP", "CDU", "CSU", "SPD", "AFD", "JFK", "JFK1",
  "CIA", "FBI", "ATF", "NSA", "DHS", "TSA", "DEA", "ICE",
  "IRGC", "ISIS", "ISIL", "PLA", "PLO", "IDF", "IAF", "IRA", "ETA",
  "EU3", "G7", "G20", "G8", "G77",
  "WHO", "WTO", "WTA", "ATP", "FIFA", "UEFA", "IOC", "NCAA", "NHL", "NBA",
  "NFL", "MLB", "MLS", "MMA", "UFC",
  "MET", "MOMA", "AMOC",
  "NSW", "VIC", "WA", "SA", "TAS", "QLD", "NT", "ACT", // Australian states
  "DR", "DPRK", "PRC", "ROC", "USSR",
  "DXB", "JFK2", "LAX", "LHR", "CDG", "FRA", "HND", "NRT", // airports
  "CAF", "CAISI", "CAR", "ADCOP", "AMEX", "EPA", "EPC",
]);

function cleanProperNoun(phrase: string): string | null {
  // Drop leading/trailing weak tokens and lowercase the result for
  // case-insensitive set intersection.
  const tokens = phrase.trim().split(/\s+/);
  while (tokens.length && PHRASE_STOP_TOKENS.has(tokens[0].toLowerCase())) {
    tokens.shift();
  }
  while (
    tokens.length &&
    PHRASE_STOP_TOKENS.has(tokens[tokens.length - 1].toLowerCase())
  ) {
    tokens.pop();
  }
  if (tokens.length < 2) return null; // need ≥2 tokens for a useful entity
  const cleaned = tokens.join(" ").toLowerCase();
  if (PHRASE_DENYLIST.has(cleaned)) return null;
  return cleaned;
}

export interface ExtractedEntities {
  tickers: string[];
  properNouns: string[];
  all: string[]; // canonical merged list, tickers prefixed with "$"
}

export function extractEntities(text: string): ExtractedEntities {
  const tickers = new Set<string>();
  const properNouns = new Set<string>();

  for (const m of text.matchAll(TICKER_RE)) {
    const sym = m[1];
    if (TICKER_STOP.has(sym) || TICKER_PSEUDO_BLOCK.has(sym)) continue;
    tickers.add(sym);
  }

  // For "naked" tickers (no $), only accept ones immediately adjacent to a
  // company-suffix pattern. e.g. "Apple Inc. (AAPL)" -> AAPL.
  const NAKED_TICKER_RE = /\(([A-Z]{1,5})(?::[A-Z]+)?\)/g;
  for (const m of text.matchAll(NAKED_TICKER_RE)) {
    const sym = m[1];
    if (TICKER_STOP.has(sym) || TICKER_PSEUDO_BLOCK.has(sym)) continue;
    tickers.add(sym);
  }

  for (const m of text.matchAll(PROPER_NOUN_RE)) {
    const cleaned = cleanProperNoun(m[1]);
    if (cleaned) properNouns.add(cleaned);
  }

  const tickerArr = Array.from(tickers).sort();
  const properArr = Array.from(properNouns).sort();
  const all = [
    ...tickerArr.map((t) => `$${t}`),
    ...properArr,
  ];
  return { tickers: tickerArr, properNouns: properArr, all };
}

/**
 * Score the overlap between two entity sets.
 * - 1 ticker match alone is enough (high signal).
 * - 2 proper noun matches required (lower signal each).
 * Returns a tuple [merge?, score].
 */
export function entityOverlap(
  a: ExtractedEntities,
  b: ExtractedEntities,
): { merge: boolean; tickerOverlap: number; properOverlap: number } {
  const tickerOverlap = a.tickers.filter((t) => b.tickers.includes(t)).length;
  const properOverlap = a.properNouns.filter((p) =>
    b.properNouns.includes(p),
  ).length;
  const merge = tickerOverlap >= 1 || properOverlap >= 2;
  return { merge, tickerOverlap, properOverlap };
}

/**
 * Build an ExtractedEntities object from a stored entity list. The DB persists
 * the merged `all` array (tickers with $ prefix, proper nouns plain); this
 * inverse split lets the merge helper work over both.
 */
export function entitiesFromStored(stored: string[]): ExtractedEntities {
  const tickers: string[] = [];
  const properNouns: string[] = [];
  for (const s of stored) {
    if (s.startsWith("$")) tickers.push(s.slice(1));
    else properNouns.push(s);
  }
  return { tickers, properNouns, all: [...stored] };
}
