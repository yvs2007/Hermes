import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "Hermes/0.1 (Journal Trader news synthesis)" },
});

export interface FeedItem {
  link: string;
  title: string;
  pubDate?: string;
  isoDate?: string;
  author?: string;
  contentSnippet?: string;
}

export async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  const feed = await parser.parseURL(feedUrl);
  return (feed.items ?? [])
    .filter((it): it is FeedItem & { link: string; title: string } =>
      Boolean(it.link && it.title),
    )
    .map((it) => ({
      link: it.link!,
      title: it.title!,
      pubDate: it.pubDate,
      isoDate: it.isoDate,
      author: (it as unknown as Record<string, string>).creator ?? it.author,
      contentSnippet: it.contentSnippet,
    }));
}

export async function fetchFeeds(
  feedUrls: string[],
  concurrency = 3,
): Promise<Array<{ url: string; items: FeedItem[]; error?: string }>> {
  const results: Array<{ url: string; items: FeedItem[]; error?: string }> = [];
  let i = 0;
  async function worker() {
    while (i < feedUrls.length) {
      const url = feedUrls[i++];
      try {
        const items = await fetchFeed(url);
        results.push({ url, items });
      } catch (e) {
        results.push({ url, items: [], error: (e as Error).message });
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, feedUrls.length) }, worker);
  await Promise.all(workers);
  return results;
}
