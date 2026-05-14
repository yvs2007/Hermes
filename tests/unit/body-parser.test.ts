import { describe, expect, it } from "vitest";
import { bodyToBlocks } from "@/lib/stories/body-parser";

describe("bodyToBlocks", () => {
  it("splits paragraphs on blank lines", () => {
    const blocks = bodyToBlocks("First paragraph[^reuters].\n\nSecond paragraph[^ap].");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe("paragraph");
  });

  it("marks the first paragraph with drop-cap", () => {
    const blocks = bodyToBlocks("Lede paragraph[^reuters].");
    if (blocks[0].kind === "paragraph") {
      expect(blocks[0].paragraph.dropCap).toBe(true);
    } else throw new Error("expected paragraph");
  });

  it("emits text + cite + text in order", () => {
    const blocks = bodyToBlocks("Before[^reuters,ap] after.");
    if (blocks[0].kind !== "paragraph") throw new Error();
    const tokens = blocks[0].paragraph.tokens;
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ kind: "text", text: "Before" });
    expect(tokens[1]).toMatchObject({
      kind: "cite",
      domains: ["reuters", "ap"],
      single: false,
    });
    expect(tokens[2]).toEqual({ kind: "text", text: " after." });
  });

  it("flags single-source citations", () => {
    const blocks = bodyToBlocks("Only one source said this[^ft].");
    if (blocks[0].kind !== "paragraph") throw new Error();
    const cite = blocks[0].paragraph.tokens.find((t) => t.kind === "cite");
    expect(cite).toMatchObject({ single: true, domains: ["ft"] });
  });

  it("handles empty input", () => {
    expect(bodyToBlocks("")).toHaveLength(0);
    expect(bodyToBlocks("\n\n  \n\n")).toHaveLength(0);
  });

  it("handles a paragraph with no citation markers", () => {
    const blocks = bodyToBlocks("No citations here.");
    if (blocks[0].kind !== "paragraph") throw new Error();
    expect(blocks[0].paragraph.tokens).toEqual([{ kind: "text", text: "No citations here." }]);
  });
});
