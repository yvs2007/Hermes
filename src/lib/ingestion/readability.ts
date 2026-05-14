import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { createHash } from "crypto";

const FETCH_TIMEOUT_MS = 15_000;
const ARCHIVE_TIMEOUT_MS = 20_000;
const MAX_BODY_CHARS = 30_000;
/** Minimum chars to consider an extraction "useful" (avoids paywall stubs) */
const MIN_USEFUL_CHARS = 300;

export interface ExtractedArticle {
  title: string;
  byline: string | null;
  content: string;
  textContent: string;
  truncated: boolean;
  /** Where the content was actually fetched from */
  fetchedVia: "direct" | "wayback" | "google-cache";
}

export async function extractArticle(
  url: string,
): Promise<ExtractedArticle | null> {
  // Try direct fetch first
  const direct = await fetchAndParse(url, FETCH_TIMEOUT_MS);
  if (direct && direct.textContent.length >= MIN_USEFUL_CHARS) {
    return { ...direct, fetchedVia: "direct" };
  }

  // Fallback: Wayback Machine
  const archived = await fetchViaWayback(url);
  if (archived && archived.textContent.length >= MIN_USEFUL_CHARS) {
    return { ...archived, fetchedVia: "wayback" };
  }

  // Fallback: Google webcache
  const cached = await fetchViaGoogleCache(url);
  if (cached && cached.textContent.length >= MIN_USEFUL_CHARS) {
    return { ...cached, fetchedVia: "google-cache" };
  }

  // Return whatever we got (even if short) or null
  if (direct) return { ...direct, fetchedVia: "direct" };
  if (archived) return { ...archived, fetchedVia: "wayback" };
  return null;
}

/** Fetch a URL and run Readability on it */
async function fetchAndParse(
  url: string,
  timeoutMs: number,
): Promise<Omit<ExtractedArticle, "fetchedVia"> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Hermes/0.1; +https://journaltrader.dev)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
  return parseHtml(html, url);
}

/** Try fetching the article from the Wayback Machine */
async function fetchViaWayback(
  url: string,
): Promise<Omit<ExtractedArticle, "fetchedVia"> | null> {
  // First check if Wayback has it
  const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ARCHIVE_TIMEOUT_MS);
  try {
    const checkRes = await fetch(availUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Hermes/0.1 (news synthesis)" },
    });
    if (!checkRes.ok) return null;
    const data = await checkRes.json() as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string } };
    };
    const snapshot = data?.archived_snapshots?.closest;
    if (!snapshot?.available || !snapshot.url) return null;

    // Fetch the archived page
    const archiveRes = await fetch(snapshot.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Hermes/0.1 (news synthesis)" },
      redirect: "follow",
    });
    if (!archiveRes.ok) return null;
    const html = await archiveRes.text();
    return parseHtml(html, url);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Try fetching from Google's webcache */
async function fetchViaGoogleCache(
  url: string,
): Promise<Omit<ExtractedArticle, "fetchedVia"> | null> {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(cacheUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseHtml(html, url);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Run Readability on raw HTML */
function parseHtml(
  html: string,
  url: string,
): Omit<ExtractedArticle, "fetchedVia"> | null {
  let article: ReturnType<Readability["parse"]>;
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    article = reader.parse();
  } catch {
    return null;
  }
  if (!article || !article.textContent) return null;

  const truncated = article.textContent.length > MAX_BODY_CHARS;
  const text = truncated
    ? article.textContent.slice(0, MAX_BODY_CHARS) + "\n[...]"
    : article.textContent;

  return {
    title: article.title ?? "",
    byline: article.byline ?? null,
    content: article.content ?? "",
    textContent: text,
    truncated,
  };
}

export function sha256(text: string): string {
  return createHash("sha256")
    .update(text.replace(/\s+/g, " ").trim())
    .digest("hex");
}
