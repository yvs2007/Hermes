import { NextResponse, type NextRequest } from "next/server";
import { extractArticle, sha256 } from "@/lib/ingestion/readability";
import {
  articleExistsByUrl,
  articleExistsByHash,
  insertArticle,
} from "@/lib/db/queries";
import { passesIngestionGate } from "@/lib/source-whitelist";

/**
 * Wayback Machine CDX API search.
 * Finds historical snapshots of news articles matching a query within a date range.
 * This lets users pull older articles for a topic to understand historical context.
 */

interface WaybackResult {
  url: string;
  timestamp: string;
  archiveUrl: string;
  domain: string;
  title?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    query: string;
    domains?: string[];
    from?: string; // ISO date
    to?: string;   // ISO date
    limit?: number;
  };

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const limit = Math.min(body.limit ?? 20, 50);
  const from = body.from ? toWaybackDate(body.from) : toWaybackDate(daysAgo(365));
  const to = body.to ? toWaybackDate(body.to) : toWaybackDate(new Date().toISOString());

  // Search across specified domains or all whitelisted sources
  const domains = body.domains?.length
    ? body.domains
    : ["reuters.com", "apnews.com", "bbc.com", "bloomberg.com", "cnbc.com", "nytimes.com", "wsj.com", "theguardian.com"];

  const results: WaybackResult[] = [];

  // Search CDX API for each domain with the query as URL filter
  const searches = domains.map((domain) =>
    searchCdx(domain, body.query, from, to, Math.ceil(limit / domains.length)),
  );
  const settled = await Promise.allSettled(searches);
  for (const r of settled) {
    if (r.status === "fulfilled") results.push(...r.value);
  }

  // Sort by date descending and cap
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const capped = results.slice(0, limit);

  // Optionally ingest the found articles
  const ingested: Array<{ url: string; title: string; domain: string; stored: boolean }> = [];
  for (const item of capped) {
    if (articleExistsByUrl(item.url)) {
      ingested.push({ url: item.url, title: item.title ?? item.url, domain: item.domain, stored: false });
      continue;
    }
    const gate = passesIngestionGate(item.url);
    if (!gate.ok) continue;

    try {
      const extracted = await extractArticle(item.archiveUrl);
      if (!extracted || extracted.textContent.length < 100) continue;

      const hash = sha256(extracted.textContent);
      if (articleExistsByHash(item.domain, hash)) {
        ingested.push({ url: item.url, title: extracted.title || item.url, domain: item.domain, stored: false });
        continue;
      }

      insertArticle({
        url: item.url,
        sourceDomain: item.domain,
        title: extracted.title || item.url,
        author: extracted.byline,
        publishedAt: waybackToIso(item.timestamp),
        content: extracted.textContent,
        contentHash: hash,
      });
      ingested.push({ url: item.url, title: extracted.title || item.url, domain: item.domain, stored: true });
    } catch {
      // Skip failures silently
    }
  }

  return NextResponse.json({
    ok: true,
    query: body.query,
    dateRange: { from, to },
    found: results.length,
    ingested: ingested.filter((i) => i.stored).length,
    articles: ingested,
  });
}

/** Search Wayback CDX API for URLs containing the query on a specific domain */
async function searchCdx(
  domain: string,
  query: string,
  from: string,
  to: string,
  limit: number,
): Promise<WaybackResult[]> {
  // CDX API: search for URLs on this domain that contain query keywords in the path
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 3);
  const urlFilter = keywords.map((kw) => `urlkey:*${kw}*`).join("&filter=");

  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}/*&output=json&limit=${limit}&from=${from}&to=${to}&filter=statuscode:200&filter=mimetype:text/html&filter=${urlFilter}&fl=timestamp,original,statuscode`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(cdxUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Hermes/0.1 (Journal Trader)" },
    });
    if (!res.ok) return [];
    const data = await res.json() as string[][];
    // First row is headers: [timestamp, original, statuscode]
    const rows = data.slice(1);
    return rows.map((row) => ({
      url: row[1],
      timestamp: row[0],
      archiveUrl: `https://web.archive.org/web/${row[0]}/${row[1]}`,
      domain,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

function toWaybackDate(isoOrDate: string): string {
  // Wayback uses YYYYMMDDHHmmss format
  return isoOrDate.replace(/[-:T]/g, "").replace(/\.\d+Z?$/, "").slice(0, 14);
}

function waybackToIso(ts: string): string {
  // 20260501143000 → 2026-05-01T14:30:00Z
  const y = ts.slice(0, 4);
  const m = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const h = ts.slice(8, 10) || "00";
  const min = ts.slice(10, 12) || "00";
  const s = ts.slice(12, 14) || "00";
  return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}
