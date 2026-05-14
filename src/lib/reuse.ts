import { embedWithProvider } from "./llm/provider";
import {
  REUSE_COSINE_THRESHOLD,
  REUSE_LINKS_COMPARE_WINDOW_HOURS,
  REUSE_TOPIC_HEADLINE_WINDOW_HOURS,
  compareHash,
  cosineSim,
  linksHash,
} from "./reuse-pure";
import {
  getStoryByLinksHash,
  getRecentStoriesWithEmbeddings,
} from "./db/queries";
import type { SynthesisMode } from "./llm/types";

export { shouldRegenerate, cosineSim, linksHash, compareHash } from "./reuse-pure";

export interface ReusableStory {
  id: string;
  slug: string;
  ageSeconds: number;
}

export interface ReuseQuery {
  mode: SynthesisMode;
  query?: string;
  urls?: string[];
  domains?: string[];
}

export async function findReusableStory(q: ReuseQuery): Promise<ReusableStory | null> {
  const nowMs = Date.now();

  if (q.mode === "links") {
    if (!q.urls?.length) return null;
    const hash = await linksHash(q.urls);
    return reuseByHash(hash, REUSE_LINKS_COMPARE_WINDOW_HOURS, nowMs);
  }

  if (q.mode === "compare") {
    if (!q.query || !q.domains?.length) return null;
    const hash = await compareHash(q.query, q.domains);
    return reuseByHash(hash, REUSE_LINKS_COMPARE_WINDOW_HOURS, nowMs);
  }

  if (!q.query?.trim()) return null;
  const cutoff = new Date(
    nowMs - REUSE_TOPIC_HEADLINE_WINDOW_HOURS * 3600_000,
  ).toISOString();

  let queryVec: number[];
  try {
    queryVec = await embedWithProvider(q.query);
  } catch {
    return null;
  }

  const rows = getRecentStoriesWithEmbeddings(cutoff, 50);

  let best: { row: (typeof rows)[number]; sim: number } | null = null;
  for (const row of rows) {
    if (!row.headline_embedding) continue;
    const vec = Array.from(
      new Float64Array(
        row.headline_embedding.buffer,
        row.headline_embedding.byteOffset,
        row.headline_embedding.byteLength / 8,
      ),
    );
    if (vec.length === 0) continue;
    const sim = cosineSim(queryVec, vec);
    if (!best || sim > best.sim) best = { row, sim };
  }
  if (!best || best.sim < REUSE_COSINE_THRESHOLD) return null;

  return {
    id: best.row.id,
    slug: best.row.slug,
    ageSeconds: Math.floor(
      (nowMs - new Date(best.row.refreshed_at).getTime()) / 1000,
    ),
  };
}

function reuseByHash(
  hash: string,
  windowHours: number,
  nowMs: number,
): ReusableStory | null {
  const cutoff = new Date(nowMs - windowHours * 3600_000).toISOString();
  const row = getStoryByLinksHash(hash, cutoff);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    ageSeconds: Math.floor(
      (nowMs - new Date(row.refreshed_at).getTime()) / 1000,
    ),
  };
}

export { incrementStoryReusedCount } from "./db/queries";
