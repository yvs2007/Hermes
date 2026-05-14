import type Database from "better-sqlite3";
import { SOURCE_WHITELIST } from "../source-whitelist";

/**
 * Seeds the sources table from the in-code whitelist. Runs on first launch
 * or when the sources table is empty. Uses INSERT OR IGNORE so existing
 * user customizations (is_active toggles) are preserved.
 */
export function seedSources(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) as n FROM sources").get() as { n: number };
  if (count.n > 0) return;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO sources
      (domain, display_name, category, aliases, rss_feed_urls, bias_rating, credibility_score, factual_reporting, is_active, notes)
    VALUES
      (@domain, @displayName, @category, @aliases, @rssFeeds, @bias, @credibility, @factual, 1, @notes)
  `);

  const tx = db.transaction(() => {
    for (const src of SOURCE_WHITELIST) {
      insert.run({
        domain: src.domain,
        displayName: src.displayName,
        category: src.category,
        aliases: JSON.stringify(src.aliases),
        rssFeeds: JSON.stringify(src.rssFeeds),
        bias: src.biasBaseline,
        credibility: src.credibilityBaseline,
        factual: src.factualReporting,
        notes: src.notes ?? null,
      });
    }
  });
  tx();
}
