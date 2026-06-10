import type Database from "better-sqlite3";

const SCHEMA_VERSION = 3;

export function initSchema(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;
  if (currentVersion >= SCHEMA_VERSION) return;

  // Migration from v1 → v2: add market_impacts column
  if (currentVersion === 1) {
    db.exec(
      `ALTER TABLE compiled_stories ADD COLUMN market_impacts TEXT NOT NULL DEFAULT '[]';`,
    );
    // fall through to v3 migration
  }

  // Migration v2 → v3: add `entities` JSON column on articles for the
  // entity-overlap second-pass clustering. Backfilled lazily by the ingest
  // pipeline (or in bulk via the backfill_entities CLI).
  if (currentVersion <= 2) {
    db.exec(
      `ALTER TABLE articles ADD COLUMN entities TEXT NOT NULL DEFAULT '[]';`,
    );
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      domain            TEXT PRIMARY KEY,
      display_name      TEXT NOT NULL,
      category          TEXT NOT NULL,
      aliases           TEXT NOT NULL DEFAULT '[]',
      rss_feed_urls     TEXT NOT NULL DEFAULT '[]',
      bias_rating       TEXT NOT NULL DEFAULT 'center',
      credibility_score REAL NOT NULL DEFAULT 80,
      factual_reporting TEXT NOT NULL DEFAULT 'high',
      is_active         INTEGER NOT NULL DEFAULT 1,
      notes             TEXT
    );

    CREATE TABLE IF NOT EXISTS articles (
      id               TEXT PRIMARY KEY,
      url              TEXT NOT NULL UNIQUE,
      source_domain    TEXT NOT NULL,
      title            TEXT NOT NULL,
      author           TEXT,
      published_at     TEXT,
      content          TEXT NOT NULL,
      content_hash     TEXT NOT NULL,
      embedding        BLOB,
      topic_cluster_id TEXT,
      entities         TEXT NOT NULL DEFAULT '[]',
      ingested_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (source_domain) REFERENCES sources(domain),
      FOREIGN KEY (topic_cluster_id) REFERENCES topic_clusters(id)
    );
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_domain);
    CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles(topic_cluster_id);
    CREATE INDEX IF NOT EXISTS idx_articles_ingested ON articles(ingested_at);

    CREATE TABLE IF NOT EXISTS topic_clusters (
      id               TEXT PRIMARY KEY,
      canonical_title  TEXT NOT NULL,
      section          TEXT NOT NULL DEFAULT 'world',
      last_updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_clusters_updated ON topic_clusters(last_updated_at);
    CREATE INDEX IF NOT EXISTS idx_clusters_section ON topic_clusters(section);

    CREATE TABLE IF NOT EXISTS compiled_stories (
      id                  TEXT PRIMARY KEY,
      slug                TEXT NOT NULL UNIQUE,
      topic_cluster_id    TEXT,
      headline            TEXT NOT NULL,
      deck                TEXT,
      body                TEXT NOT NULL,
      source_domains      TEXT NOT NULL DEFAULT '[]',
      claim_attributions  TEXT NOT NULL DEFAULT '[]',
      disagreements       TEXT NOT NULL DEFAULT '[]',
      single_source_claims TEXT NOT NULL DEFAULT '[]',
      market_impacts      TEXT NOT NULL DEFAULT '[]',
      source_mode         TEXT NOT NULL,
      llm_provider        TEXT NOT NULL,
      model_version       TEXT NOT NULL,
      confidence          REAL NOT NULL DEFAULT 0,
      notes               TEXT,
      links_hash          TEXT,
      headline_embedding  BLOB,
      reused_count        INTEGER NOT NULL DEFAULT 0,
      refreshed_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (topic_cluster_id) REFERENCES topic_clusters(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stories_slug ON compiled_stories(slug);
    CREATE INDEX IF NOT EXISTS idx_stories_cluster ON compiled_stories(topic_cluster_id);
    CREATE INDEX IF NOT EXISTS idx_stories_refreshed ON compiled_stories(refreshed_at);
    CREATE INDEX IF NOT EXISTS idx_stories_links_hash ON compiled_stories(links_hash);

    CREATE TABLE IF NOT EXISTS synthesis_history (
      id                TEXT PRIMARY KEY,
      query_text        TEXT NOT NULL DEFAULT '',
      source_mode       TEXT NOT NULL,
      compiled_story_id TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (compiled_story_id) REFERENCES compiled_stories(id)
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}
