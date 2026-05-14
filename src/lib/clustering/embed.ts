import { embedWithProvider } from "../llm/provider";

export async function embed(text: string): Promise<number[]> {
  return embedWithProvider(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (const t of texts) out.push(await embed(t));
  return out;
}
