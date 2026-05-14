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

const SYNTH_MODEL = "gpt-4.1";
const ANALYZE_MODEL = "gpt-4.1-mini";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
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
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: SYNTH_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
          { role: "user", content: buildSynthesisUserPrompt(canonicalTitle, articles, opts) },
        ],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`OpenAI API ${resp.status}: ${text.slice(0, 400)}`);
    }
    const json = await resp.json();
    return parseJsonResponse<SynthesisResponse>(json.choices?.[0]?.message?.content ?? "");
  }

  async analyzeArticle(article: ArticleInput): Promise<ArticleAnalysis> {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: ANALYZE_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PER_ARTICLE_SYSTEM_PROMPT },
          { role: "user", content: buildPerArticleUserPrompt(article) },
        ],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`OpenAI API ${resp.status}: ${text.slice(0, 400)}`);
    }
    const json = await resp.json();
    return parseJsonResponse<ArticleAnalysis>(json.choices?.[0]?.message?.content ?? "");
  }

  async embed(text: string): Promise<number[]> {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`OpenAI Embeddings API ${resp.status}: ${text.slice(0, 400)}`);
    }
    const json = await resp.json();
    return json.data[0].embedding;
  }
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
