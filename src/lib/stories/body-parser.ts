import type { BodyBlock } from "@/lib/types/story";

/**
 * Parse a synthesis-mode markdown body into the BodyBlock[] our renderer
 * expects. Citation markers in the LLM's output have the form
 * `[^domain1,domain2]`; they become `cite` tokens. The first paragraph gets
 * the drop-cap treatment.
 *
 * Disagreement callouts arrive in the structured `disagreements` field, not
 * the markdown body, so they are not parsed here — `StoryView` interleaves
 * them separately in the future when we wire the disagreements panel into
 * the DB read path.
 */
export function bodyToBlocks(markdown: string | null | undefined): BodyBlock[] {
  if (!markdown) return [];
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: BodyBlock[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const block: BodyBlock = { kind: "paragraph", paragraph: { tokens: [] } };
    if (i === 0) block.paragraph.dropCap = true;

    const re = /\[\^([^\]]+)\]/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p)) !== null) {
      if (m.index > lastIndex) {
        block.paragraph.tokens.push({
          kind: "text",
          text: p.slice(lastIndex, m.index),
        });
      }
      const domains = m[1]
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      // Single-source claims arrive as a single domain — flag them so the UI
      // can render the accent-red treatment.
      block.paragraph.tokens.push({
        kind: "cite",
        domains,
        single: domains.length === 1,
      });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < p.length) {
      block.paragraph.tokens.push({ kind: "text", text: p.slice(lastIndex) });
    }
    blocks.push(block);
  }
  return blocks;
}
