import { describe, it, expect } from "vitest";
import { entityOverlap, extractEntities } from "../../src/lib/clustering/entities";

describe("extractEntities", () => {
  it("pulls cashtags", () => {
    const { tickers } = extractEntities("Apple Inc. ($AAPL) reported strong earnings.");
    expect(tickers).toContain("AAPL");
  });

  it("pulls parenthesised tickers", () => {
    const { tickers } = extractEntities("Spirit Airlines (SAVE) shutting down.");
    expect(tickers).toContain("SAVE");
  });

  it("rejects acronym stoplist", () => {
    const { tickers } = extractEntities("USA CEO GDP $USA $CEO");
    // $USA/$CEO are cashtag matches but on the stop list
    expect(tickers).not.toContain("USA");
    expect(tickers).not.toContain("CEO");
  });

  it("extracts multi-word proper nouns", () => {
    const { properNouns } = extractEntities(
      "Spirit Airlines and Walt Disney Company both reported earnings today.",
    );
    expect(properNouns).toContain("spirit airlines");
    expect(properNouns).toContain("walt disney company");
  });

  it("strips leading weak tokens", () => {
    const { properNouns } = extractEntities("The Spirit Airlines deal collapsed Monday.");
    // "The Spirit Airlines" → "spirit airlines"
    expect(properNouns).toContain("spirit airlines");
    expect(properNouns).not.toContain("the spirit airlines");
  });

  it("rejects denylisted generic phrases", () => {
    const { properNouns } = extractEntities("White House announces Wall Street rule.");
    expect(properNouns).not.toContain("white house");
    expect(properNouns).not.toContain("wall street");
  });

  it("requires ≥2 tokens for proper nouns", () => {
    const { properNouns } = extractEntities("Apple did something. Microsoft also.");
    // single-word "Apple" / "Microsoft" alone shouldn't match (they would
    // dominate matches and create false merges)
    expect(properNouns).not.toContain("apple");
    expect(properNouns).not.toContain("microsoft");
  });
});

describe("entityOverlap", () => {
  it("merges on any ticker match", () => {
    const a = extractEntities("Spirit Airlines (SAVE) wins lifeline.");
    const b = extractEntities("$SAVE shares jump as rescue talks resume.");
    const ov = entityOverlap(a, b);
    expect(ov.merge).toBe(true);
    expect(ov.tickerOverlap).toBeGreaterThanOrEqual(1);
  });

  it("requires ≥2 proper-noun matches", () => {
    const a = extractEntities("Spirit Airlines shut down on Tuesday.");
    const b = extractEntities("Walt Disney Company reported strong earnings.");
    expect(entityOverlap(a, b).merge).toBe(false);
  });

  it("merges when two strong proper nouns coincide", () => {
    const a = extractEntities("Spirit Airlines lays off staff; Frontier Airlines walks away.");
    const b = extractEntities("Frontier Airlines pulls Spirit Airlines bid amid debt fight.");
    const ov = entityOverlap(a, b);
    expect(ov.merge).toBe(true);
    expect(ov.properOverlap).toBeGreaterThanOrEqual(2);
  });
});
