import { randomUUID } from "crypto";
import { getDb } from "./connection";
import { seedSources } from "./seed";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface SourceRow {
  domain: string;
  display_name: string;
  category: string;
  aliases: string;
  rss_feed_urls: string;
  bias_rating: string;
  credibility_score: number;
  factual_reporting: string;
  is_active: number;
  notes: string | null;
}

export function getActiveSources(): SourceRow[] {
  const db = getDb();
  seedSources(db);
  return db.prepare("SELECT * FROM sources WHERE is_active = 1").all() as SourceRow[];
}

export function getAllSources(): SourceRow[] {
  const db = getDb();
  seedSources(db);
  return db.prepare("SELECT * FROM sources ORDER BY domain").all() as SourceRow[];
}

export function setSourceActive(domain: string, active: boolean): void {
  const db = getDb();
  db.prepare("UPDATE sources SET is_active = ? WHERE domain = ?").run(active ? 1 : 0, domain);
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export interface ArticleRow {
  id: string;
  url: string;
  source_domain: string;
  title: string;
  author: string | null;
  published_at: string | null;
  content: string;
  content_hash: string;
  topic_cluster_id: string | null;
  entities: string; // JSON-encoded string[]; parse at the call site.
  ingested_at: string;
}

export function articleExistsByUrl(url: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT id FROM articles WHERE url = ?").get(url);
  return Boolean(row);
}

export function articleExistsByHash(sourceDomain: string, hash: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM articles WHERE source_domain = ? AND content_hash = ?")
    .get(sourceDomain, hash);
  return Boolean(row);
}

export function insertArticle(data: {
  url: string;
  sourceDomain: string;
  title: string;
  author?: string | null;
  publishedAt?: string | null;
  content: string;
  contentHash: string;
}): string {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO articles (id, url, source_domain, title, author, published_at, content, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.url, data.sourceDomain, data.title, data.author ?? null, data.publishedAt ?? null, data.content, data.contentHash);
  return id;
}

export function getArticleByUrl(url: string): ArticleRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM articles WHERE url = ?").get(url) as ArticleRow | undefined;
}

export function updateArticleEmbedding(id: string, embedding: number[]): void {
  const db = getDb();
  const buf = Buffer.from(new Float64Array(embedding).buffer);
  db.prepare("UPDATE articles SET embedding = ? WHERE id = ?").run(buf, id);
}

export function updateArticleCluster(id: string, clusterId: string): void {
  const db = getDb();
  db.prepare("UPDATE articles SET topic_cluster_id = ? WHERE id = ?").run(clusterId, id);
}

export function setArticleEntities(id: string, entities: string[]): void {
  const db = getDb();
  db.prepare("UPDATE articles SET entities = ? WHERE id = ?").run(
    JSON.stringify(entities),
    id,
  );
}

export function getArticleEntities(id: string): string[] {
  const db = getDb();
  const row = db.prepare("SELECT entities FROM articles WHERE id = ?").get(id) as
    | { entities: string }
    | undefined;
  if (!row) return [];
  try {
    return JSON.parse(row.entities) as string[];
  } catch {
    return [];
  }
}

/**
 * Union of entities across all articles in a cluster. Used by the entity
 * overlap second-pass when deciding whether to attach a new article.
 */
export function getClusterEntities(clusterId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT entities FROM articles WHERE topic_cluster_id = ?")
    .all(clusterId) as Array<{ entities: string }>;
  const out = new Set<string>();
  for (const r of rows) {
    try {
      for (const e of JSON.parse(r.entities) as string[]) out.add(e);
    } catch {
      // skip malformed rows
    }
  }
  return Array.from(out);
}

/**
 * Articles that have never had entity extraction run (entities = '[]').
 * Used by the backfill_entities CLI.
 */
export function getArticlesMissingEntities(limit: number): ArticleRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM articles WHERE entities = '[]' ORDER BY ingested_at ASC LIMIT ?",
    )
    .all(limit) as ArticleRow[];
}

export function getArticleEmbedding(id: string): number[] | null {
  const db = getDb();
  const row = db.prepare("SELECT embedding FROM articles WHERE id = ?").get(id) as
    | { embedding: Buffer | null }
    | undefined;
  if (!row?.embedding) return null;
  return Array.from(new Float64Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 8));
}

export function getRecentArticlesByQuery(query: string, sinceIso: string, limit = 8, filterDomains?: string[]): ArticleRow[] {
  const db = getDb();
  // Search both title and content — title matches ranked first
  let sql = `SELECT *,
    CASE WHEN title LIKE ? COLLATE NOCASE THEN 1 ELSE 0 END as title_match
    FROM articles WHERE ingested_at >= ? AND (title LIKE ? COLLATE NOCASE OR content LIKE ? COLLATE NOCASE)`;
  const like = `%${query}%`;
  const params: unknown[] = [like, sinceIso, like, like];
  if (filterDomains?.length) {
    sql += ` AND source_domain IN (${filterDomains.map(() => "?").join(",")})`;
    params.push(...filterDomains);
  }
  sql += ` ORDER BY title_match DESC, ingested_at DESC LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params) as ArticleRow[];
}

export function suggestTopics(partial: string, limit = 8): Array<{ title: string; source_domain: string; ingested_at: string }> {
  const db = getDb();
  const like = `%${partial}%`;
  return db.prepare(
    `SELECT DISTINCT title, source_domain, MAX(ingested_at) as ingested_at
     FROM articles
     WHERE title LIKE ? COLLATE NOCASE OR content LIKE ? COLLATE NOCASE
     GROUP BY title
     ORDER BY ingested_at DESC
     LIMIT ?`,
  ).all(like, like, limit) as Array<{ title: string; source_domain: string; ingested_at: string }>;
}

export function getArticlesByCluster(clusterId: string, limit = 8): ArticleRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM articles WHERE topic_cluster_id = ? ORDER BY published_at DESC LIMIT ?")
    .all(clusterId, limit) as ArticleRow[];
}

export function countNewArticlesInCluster(clusterId: string, sinceIso: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as n FROM articles WHERE topic_cluster_id = ? AND ingested_at > ?")
    .get(clusterId, sinceIso) as { n: number };
  return row.n;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function updateSourceLastIngested(_domain: string): void {
  // sources table doesn't have last_ingested_at column yet —
  // no-op. The ingestion pipeline works without it.
}

// ---------------------------------------------------------------------------
// Topic Clusters
// ---------------------------------------------------------------------------

export interface ClusterRow {
  id: string;
  canonical_title: string;
  section: string;
  last_updated_at: string;
}

export function insertCluster(canonicalTitle: string, section = "world"): string {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO topic_clusters (id, canonical_title, section) VALUES (?, ?, ?)",
  ).run(id, canonicalTitle, section);
  return id;
}

export function updateClusterTimestamp(id: string): void {
  const db = getDb();
  db.prepare("UPDATE topic_clusters SET last_updated_at = datetime('now') WHERE id = ?").run(id);
}

export function getRecentClusters(section: string, sinceIso: string, limit = 4): ClusterRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM topic_clusters WHERE section = ? AND last_updated_at >= ? ORDER BY last_updated_at DESC LIMIT ?",
    )
    .all(section, sinceIso, limit) as ClusterRow[];
}

export function getClusterEmbeddings(clusterId: string): number[][] {
  const db = getDb();
  const rows = db
    .prepare("SELECT embedding FROM articles WHERE topic_cluster_id = ? AND embedding IS NOT NULL LIMIT 20")
    .all(clusterId) as Array<{ embedding: Buffer }>;
  return rows.map((r) =>
    Array.from(new Float64Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 8)),
  );
}

export function getAllRecentClusterIds(sinceIso: string): ClusterRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM topic_clusters WHERE last_updated_at >= ? ORDER BY last_updated_at DESC")
    .all(sinceIso) as ClusterRow[];
}

/**
 * Clusters that have never been synthesized into a compiled_story.
 *
 * Ordered by article-count DESC so the multi-source clusters (which Plutus's
 * coverage_breadth gate actually wants) get drained first. `minArticles`
 * lets callers filter out single-article clusters that would never satisfy
 * any reasonable strategy trigger.
 */
export function getUnsynthesizedClusters(
  limit: number,
  minArticles = 1,
): ClusterRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT tc.*
         FROM topic_clusters tc
         LEFT JOIN compiled_stories cs ON cs.topic_cluster_id = tc.id
        WHERE cs.id IS NULL
        GROUP BY tc.id
       HAVING (
         SELECT count(*) FROM articles a
          WHERE a.topic_cluster_id = tc.id
       ) >= ?
        ORDER BY (
          SELECT count(*) FROM articles a
           WHERE a.topic_cluster_id = tc.id
        ) DESC,
        tc.last_updated_at DESC
        LIMIT ?`,
    )
    .all(minArticles, limit) as ClusterRow[];
}

export function countUnsynthesizedClusters(minArticles = 1): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT count(*) AS n FROM (
         SELECT tc.id FROM topic_clusters tc
         LEFT JOIN compiled_stories cs ON cs.topic_cluster_id = tc.id
          WHERE cs.id IS NULL
          GROUP BY tc.id
         HAVING (
           SELECT count(*) FROM articles a
            WHERE a.topic_cluster_id = tc.id
         ) >= ?
       )`,
    )
    .get(minArticles) as { n: number };
  return row.n;
}

// ---------------------------------------------------------------------------
// Compiled Stories
// ---------------------------------------------------------------------------

export interface CompiledStoryRow {
  id: string;
  slug: string;
  topic_cluster_id: string | null;
  headline: string;
  deck: string | null;
  body: string;
  source_domains: string;
  claim_attributions: string;
  disagreements: string;
  single_source_claims: string;
  market_impacts: string;
  source_mode: string;
  llm_provider: string;
  model_version: string;
  confidence: number;
  notes: string | null;
  links_hash: string | null;
  reused_count: number;
  refreshed_at: string;
}

export function insertCompiledStory(data: {
  slug: string;
  topicClusterId?: string | null;
  headline: string;
  deck?: string | null;
  body: string;
  sourceDomains: string[];
  claimAttributions: unknown[];
  disagreements: unknown[];
  singleSourceClaims: unknown[];
  marketImpacts: unknown[];
  sourceMode: string;
  llmProvider: string;
  modelVersion: string;
  confidence: number;
  notes?: string | null;
  linksHash?: string | null;
  headlineEmbedding?: number[] | null;
}): string {
  const db = getDb();
  const id = randomUUID();
  const embBuf = data.headlineEmbedding
    ? Buffer.from(new Float64Array(data.headlineEmbedding).buffer)
    : null;

  db.prepare(
    `INSERT INTO compiled_stories
       (id, slug, topic_cluster_id, headline, deck, body, source_domains,
        claim_attributions, disagreements, single_source_claims, market_impacts,
        source_mode, llm_provider, model_version, confidence, notes, links_hash,
        headline_embedding)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.slug,
    data.topicClusterId ?? null,
    data.headline,
    data.deck ?? null,
    data.body,
    JSON.stringify(data.sourceDomains),
    JSON.stringify(data.claimAttributions),
    JSON.stringify(data.disagreements),
    JSON.stringify(data.singleSourceClaims),
    JSON.stringify(data.marketImpacts),
    data.sourceMode,
    data.llmProvider,
    data.modelVersion,
    data.confidence,
    data.notes ?? null,
    data.linksHash ?? null,
    embBuf,
  );
  return id;
}

export function getCompiledStoryBySlug(slug: string): CompiledStoryRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM compiled_stories WHERE slug = ? ORDER BY refreshed_at DESC LIMIT 1")
    .get(slug) as CompiledStoryRow | undefined;
}

export function getRecentCompiledStories(limit = 8): CompiledStoryRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM compiled_stories ORDER BY refreshed_at DESC LIMIT ?")
    .all(limit) as CompiledStoryRow[];
}

export function getLatestStoryForCluster(clusterId: string): CompiledStoryRow | undefined {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM compiled_stories WHERE topic_cluster_id = ? ORDER BY refreshed_at DESC LIMIT 1",
    )
    .get(clusterId) as CompiledStoryRow | undefined;
}

export function getStoryByLinksHash(hash: string, sinceIso: string): CompiledStoryRow | undefined {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM compiled_stories WHERE links_hash = ? AND refreshed_at >= ? ORDER BY refreshed_at DESC LIMIT 1",
    )
    .get(hash, sinceIso) as CompiledStoryRow | undefined;
}

export function getRecentStoriesWithEmbeddings(sinceIso: string, limit = 50): Array<CompiledStoryRow & { headline_embedding: Buffer | null }> {
  const db = getDb();
  return db
    .prepare(
      "SELECT *, headline_embedding FROM compiled_stories WHERE refreshed_at >= ? AND headline_embedding IS NOT NULL ORDER BY refreshed_at DESC LIMIT ?",
    )
    .all(sinceIso, limit) as Array<CompiledStoryRow & { headline_embedding: Buffer | null }>;
}

export function incrementStoryReusedCount(id: string): void {
  const db = getDb();
  db.prepare("UPDATE compiled_stories SET reused_count = reused_count + 1 WHERE id = ?").run(id);
}

export function getCompiledStoryById(id: string): CompiledStoryRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM compiled_stories WHERE id = ?").get(id) as CompiledStoryRow | undefined;
}

// ---------------------------------------------------------------------------
// Synthesis History
// ---------------------------------------------------------------------------

export function recordSynthesis(data: {
  queryText: string;
  sourceMode: string;
  compiledStoryId: string;
}): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO synthesis_history (id, query_text, source_mode, compiled_story_id) VALUES (?, ?, ?, ?)",
  ).run(randomUUID(), data.queryText, data.sourceMode, data.compiledStoryId);
}

export function getRecentSyntheses(limit = 10): Array<{
  id: string;
  query_text: string;
  source_mode: string;
  compiled_story_id: string;
  created_at: string;
}> {
  const db = getDb();
  return db
    .prepare("SELECT * FROM synthesis_history ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Array<{
    id: string;
    query_text: string;
    source_mode: string;
    compiled_story_id: string;
    created_at: string;
  }>;
}
