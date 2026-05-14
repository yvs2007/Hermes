import { describe, expect, it } from "vitest";
import {
  REGENERATE_AGE_HOURS,
  REGENERATE_NEW_ARTICLES,
  REUSE_COSINE_THRESHOLD,
  compareHash,
  cosineSim,
  linksHash,
  normalizeUrl,
  shouldRegenerate,
} from "../../supabase/functions/_shared/reuse-pure.ts";

describe("normalizeUrl", () => {
  it("lowercases host and strips www", () => {
    expect(normalizeUrl("https://WWW.Reuters.com/world/x")).toBe(
      "https://reuters.com/world/x",
    );
  });

  it("drops trailing slashes", () => {
    expect(normalizeUrl("https://reuters.com/world/")).toBe(
      "https://reuters.com/world",
    );
  });

  it("strips fragments and tracking params", () => {
    expect(
      normalizeUrl("https://reuters.com/world/x?utm_source=x&utm_campaign=y&id=42#section"),
    ).toBe("https://reuters.com/world/x?id=42");
  });

  it("returns null on garbage input", () => {
    expect(normalizeUrl(":::not a url:::")).toBeNull();
  });
});

describe("linksHash", () => {
  it("is order-independent (sorted before hashing)", async () => {
    const a = await linksHash([
      "https://reuters.com/a",
      "https://apnews.com/b",
    ]);
    const b = await linksHash([
      "https://apnews.com/b",
      "https://reuters.com/a",
    ]);
    expect(a).toBe(b);
  });

  it("collapses url-equivalent inputs (case, www, tracking) to one hash", async () => {
    const a = await linksHash([
      "https://www.Reuters.com/world/x?utm_source=x",
      "https://apnews.com/y/",
    ]);
    const b = await linksHash([
      "https://reuters.com/world/x",
      "https://apnews.com/y",
    ]);
    expect(a).toBe(b);
  });

  it("differentiates distinct URL sets", async () => {
    const a = await linksHash(["https://reuters.com/a", "https://apnews.com/b"]);
    const c = await linksHash(["https://reuters.com/a", "https://apnews.com/c"]);
    expect(a).not.toBe(c);
  });

  it("dedupes identical URLs", async () => {
    const a = await linksHash(["https://reuters.com/a", "https://reuters.com/a"]);
    const b = await linksHash(["https://reuters.com/a"]);
    expect(a).toBe(b);
  });

  it("produces a 64-char hex string", async () => {
    const h = await linksHash(["https://reuters.com/a"]);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("compareHash", () => {
  it("normalizes whitespace + case in the topic", async () => {
    const a = await compareHash("  Federal   Reserve   Rate Decision  ", [
      "reuters.com",
      "apnews.com",
    ]);
    const b = await compareHash("federal reserve rate decision", [
      "apnews.com",
      "reuters.com",
    ]);
    expect(a).toBe(b);
  });

  it("differentiates different topics", async () => {
    const a = await compareHash("fed rate decision", ["reuters.com"]);
    const b = await compareHash("ecb rate decision", ["reuters.com"]);
    expect(a).not.toBe(b);
  });

  it("differentiates different domain sets", async () => {
    const a = await compareHash("topic", ["reuters.com", "apnews.com"]);
    const b = await compareHash("topic", ["reuters.com", "bloomberg.com"]);
    expect(a).not.toBe(b);
  });
});

describe("cosineSim", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSim([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSim([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
  });

  it("is 0 on length mismatch", () => {
    expect(cosineSim([1, 2], [1, 2, 3])).toBe(0);
  });

  it("is 0 for empty vectors", () => {
    expect(cosineSim([], [])).toBe(0);
  });

  it("threshold constant matches the doc-specified 0.88", () => {
    expect(REUSE_COSINE_THRESHOLD).toBe(0.88);
  });
});

describe("shouldRegenerate", () => {
  const baseRefresh = new Date("2026-05-03T12:00:00Z");
  const justAfter = new Date("2026-05-03T12:30:00Z"); // 30 min later
  const sixHoursAfter = new Date("2026-05-03T18:00:00Z");

  it("regenerates when ≥ 3 new articles regardless of age (rule b)", () => {
    expect(
      shouldRegenerate({
        refreshedAt: baseRefresh,
        newArticleCount: REGENERATE_NEW_ARTICLES,
        hasAnyNewArticle: true,
        now: justAfter,
      }),
    ).toBe(true);
  });

  it("does not regenerate at < 3 new articles and < 6h age", () => {
    expect(
      shouldRegenerate({
        refreshedAt: baseRefresh,
        newArticleCount: 1,
        hasAnyNewArticle: true,
        now: justAfter,
      }),
    ).toBe(false);
  });

  it("regenerates at 6h+ age WITH any new article (rule c)", () => {
    expect(
      shouldRegenerate({
        refreshedAt: baseRefresh,
        newArticleCount: 1,
        hasAnyNewArticle: true,
        now: sixHoursAfter,
      }),
    ).toBe(true);
  });

  it("does not regenerate at 6h+ age with no new articles", () => {
    expect(
      shouldRegenerate({
        refreshedAt: baseRefresh,
        newArticleCount: 0,
        hasAnyNewArticle: false,
        now: sixHoursAfter,
      }),
    ).toBe(false);
  });

  it("uses the documented constants", () => {
    expect(REGENERATE_NEW_ARTICLES).toBe(3);
    expect(REGENERATE_AGE_HOURS).toBe(6);
  });
});
