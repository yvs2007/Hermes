import {
  getActiveSources,
  articleExistsByUrl,
  articleExistsByHash,
  insertArticle,
  updateArticleEmbedding,
} from "@/lib/db/queries";
import { passesIngestionGate } from "@/lib/source-whitelist";
import { fetchFeeds } from "@/lib/ingestion/rss";
import { extractArticle, sha256 } from "@/lib/ingestion/readability";
import { embed } from "@/lib/clustering/embed";
import { attachToCluster } from "@/lib/clustering/cluster";

export interface IngestStats {
  sources: number;
  feedsTried: number;
  itemsSeen: number;
  itemsRejected: number;
  itemsExtracted: number;
  itemsStored: number;
  errors: Array<{ url: string; reason: string }>;
}

export async function runIngest(): Promise<IngestStats> {
  const stats: IngestStats = {
    sources: 0,
    feedsTried: 0,
    itemsSeen: 0,
    itemsRejected: 0,
    itemsExtracted: 0,
    itemsStored: 0,
    errors: [],
  };

  const sources = getActiveSources();
  stats.sources = sources.length;

  for (const src of sources) {
    const feedUrls: string[] = JSON.parse(src.rss_feed_urls);
    if (!feedUrls.length) continue;

    const feeds = await fetchFeeds(feedUrls);
    for (const feed of feeds) {
      stats.feedsTried++;
      if (feed.error) {
        stats.errors.push({ url: feed.url, reason: feed.error });
        continue;
      }
      for (const item of feed.items) {
        stats.itemsSeen++;
        const gate = passesIngestionGate(item.link);
        if (!gate.ok || !gate.source) {
          stats.itemsRejected++;
          continue;
        }
        if (articleExistsByUrl(item.link)) continue;

        let content: string | null = null;
        const extracted = await extractArticle(item.link);
        if (extracted?.textContent) {
          content = extracted.textContent;
          stats.itemsExtracted++;
        } else if (item.contentSnippet && item.contentSnippet.length >= 50) {
          content = item.contentSnippet;
          stats.itemsExtracted++;
        }
        if (!content) continue;

        const hash = sha256(content);
        if (articleExistsByHash(gate.source.domain, hash)) continue;

        const articleId = insertArticle({
          url: item.link,
          sourceDomain: gate.source.domain,
          title: item.title,
          author: item.author ?? null,
          publishedAt: item.isoDate ?? item.pubDate ?? null,
          content,
          contentHash: hash,
        });
        stats.itemsStored++;

        try {
          const vec = await embed(`${item.title}\n\n${content.slice(0, 600)}`);
          updateArticleEmbedding(articleId, vec);
          attachToCluster(articleId, vec, item.title);
        } catch (e) {
          stats.errors.push({
            url: item.link,
            reason: `embed/cluster: ${(e as Error).message}`,
          });
        }
      }
    }
  }

  return stats;
}
