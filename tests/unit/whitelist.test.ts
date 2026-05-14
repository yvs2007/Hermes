import { describe, expect, it } from "vitest";
import {
  isForbesContributor,
  isWhitelisted,
  passesIngestionGate,
  resolveSource,
} from "@/lib/source-whitelist";

describe("source-whitelist resolveSource", () => {
  it("matches a canonical domain", () => {
    expect(resolveSource("https://www.reuters.com/world/foo")?.domain).toBe(
      "reuters.com",
    );
  });

  it("matches an alias", () => {
    expect(resolveSource("https://www.bbc.co.uk/news/123")?.domain).toBe("bbc.com");
  });

  it("matches a subdomain", () => {
    // www3.nhk.or.jp is a subdomain of nhk.or.jp (which is canonical) and
    // also explicitly listed as an alias — exercises both the suffix and
    // alias paths.
    expect(resolveSource("https://www3.nhk.or.jp/news/x")?.domain).toBe("nhk.or.jp");
  });

  it("returns null for non-whitelisted hosts", () => {
    expect(resolveSource("https://news.example.com/x")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(resolveSource(":::not a url:::")).toBeNull();
  });
});

describe("isWhitelisted", () => {
  it("accepts whitelisted URLs", () => {
    expect(isWhitelisted("https://apnews.com/article/x")).toBe(true);
  });

  it("rejects non-whitelisted URLs", () => {
    expect(isWhitelisted("https://breitbart.com/x")).toBe(false);
  });
});

describe("Forbes contributor exclusion", () => {
  it("flags /sites/ paths", () => {
    expect(
      isForbesContributor("https://www.forbes.com/sites/randomperson/2026/01/01/x/"),
    ).toBe(true);
  });

  it("does not flag staff URLs", () => {
    expect(isForbesContributor("https://www.forbes.com/business/article/x")).toBe(false);
  });

  it("passesIngestionGate rejects Forbes contributor URLs", () => {
    const gate = passesIngestionGate(
      "https://www.forbes.com/sites/randomperson/2026/01/01/x/",
    );
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("forbes-contributor-excluded");
  });

  it("passesIngestionGate accepts staff Forbes URLs", () => {
    const gate = passesIngestionGate(
      "https://www.forbes.com/business/article/clean-staff-url/",
    );
    expect(gate.ok).toBe(true);
  });
});
