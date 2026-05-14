import type { MetadataRoute } from "next";
import { COMPILED_STORIES } from "@/lib/fixtures/stories";
import { getRecentCompiledStories } from "@/lib/db/queries";

const STATIC_PATHS = [
  "",
  "/how-it-works",
  "/settings",
  "/section/world",
  "/section/us",
  "/section/business",
  "/section/markets",
  "/section/tech",
  "/section/culture",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();
  const out: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${siteUrl}${p}`,
    lastModified: now,
    changeFrequency: p === "" ? "hourly" : "daily",
    priority: p === "" ? 1.0 : 0.7,
  }));

  let storySlugs: Array<{ slug: string; refreshed_at: string }> = [];
  try {
    const rows = getRecentCompiledStories(1000);
    if (rows.length > 0) {
      storySlugs = rows.map((r) => ({ slug: r.slug, refreshed_at: r.refreshed_at }));
    }
  } catch {
    // fall through to fixtures
  }
  if (storySlugs.length === 0) {
    storySlugs = Object.values(COMPILED_STORIES).map((s) => ({
      slug: s.slug,
      refreshed_at: s.refreshedAt,
    }));
  }
  for (const s of storySlugs) {
    out.push({
      url: `${siteUrl}/topic/${s.slug}`,
      lastModified: new Date(s.refreshed_at),
      changeFrequency: "daily",
      priority: 0.6,
    });
  }
  return out;
}
