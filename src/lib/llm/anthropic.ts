import type { LLMProvider } from "./provider";
import type {
  ArticleAnalysis,
  ArticleInput,
  SynthOpts,
  SynthesisResponse,
} from "./types";
import {
  PER_ARTICLE_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildPerArticleUserPrompt,
  buildSynthesisUserPrompt,
} from "./prompts";

const SYNTH_MODEL = "claude-sonnet-4-6";
const ANALYZE_MODEL = "claude-haiku-4-5-20251001";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly modelVersion = SYNTH_MODEL;

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(
    canonicalTitle: string,
    articles: ArticleInput[],
    opts: SynthOpts,
  ): Promise<SynthesisResponse> {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SYNTH_MODEL,
        max_tokens: 4096,
        system: SYNTHESIS_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildSynthesisUserPrompt(canonicalTitle, articles, opts) },
        ],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Anthropic API ${resp.status}: ${text.slice(0, 400)}`);
    }
    const msg = await resp.json();
    const text = extractText(msg);
    return parseJsonResponse<SynthesisResponse>(text);
  }

  async analyzeArticle(article: ArticleInput): Promise<ArticleAnalysis> {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANALYZE_MODEL,
        max_tokens: 2048,
        system: PER_ARTICLE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildPerArticleUserPrompt(article) }],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Anthropic API ${resp.status}: ${text.slice(0, 400)}`);
    }
    const msg = await resp.json();
    const text = extractText(msg);
    return parseJsonResponse<ArticleAnalysis>(text);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async embed(_text: string): Promise<number[]> {
    throw new Error(
      "AnthropicProvider does not support embeddings; configure Ollama or OpenAI for embeddings",
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(msg: any): string {
  if (!Array.isArray(msg?.content)) return "";
  return msg.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((c: any) => c.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => c.text)
    .join("");
}

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Provider returned non-JSON response: ${(e as Error).message}`);
  }
}
