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

const DEFAULT_SYNTH_MODEL = "deepseek-r1-distill-qwen-32b";
const DEFAULT_ANALYZE_MODEL = "gemma3:4b";
const DEFAULT_EMBED_MODEL = "nomic-embed-text";
const SYNTH_TIMEOUT_MS = 300_000;
const ANALYZE_TIMEOUT_MS = 30_000;
const EMBED_TIMEOUT_MS = 15_000;

export interface LocalLLMConfig {
  baseUrl: string;
  bearerToken: string | null;
  synthModel: string;
  analyzeModel: string;
  embedModel: string;
}

export function loadLocalLLMConfig(): LocalLLMConfig {
  const baseUrl = process.env.LLM_BASE_URL ?? "http://localhost:11434";
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    bearerToken: process.env.LLM_BEARER_TOKEN ?? null,
    synthModel: process.env.LLM_SYNTHESIS_MODEL ?? DEFAULT_SYNTH_MODEL,
    analyzeModel: process.env.LLM_ANALYSIS_MODEL ?? DEFAULT_ANALYZE_MODEL,
    embedModel: process.env.LLM_EMBEDDING_MODEL ?? DEFAULT_EMBED_MODEL,
  };
}

export abstract class LocalLLMBase implements LLMProvider {
  abstract readonly name: string;
  protected readonly cfg: LocalLLMConfig;

  constructor(cfg?: LocalLLMConfig) {
    this.cfg = cfg ?? loadLocalLLMConfig();
  }

  get modelVersion(): string {
    return this.cfg.synthModel;
  }

  abstract synthesize(
    canonicalTitle: string,
    articles: ArticleInput[],
    opts: SynthOpts,
  ): Promise<SynthesisResponse>;

  abstract analyzeArticle(article: ArticleInput): Promise<ArticleAnalysis>;

  abstract embed(text: string): Promise<number[]>;

  protected headers(): HeadersInit {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.bearerToken) h["authorization"] = `Bearer ${this.cfg.bearerToken}`;
    return h;
  }

  protected async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${this.cfg.baseUrl}${path}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`local LLM ${r.status} ${r.statusText} on ${path}: ${text.slice(0, 400)}`);
      }
      return (await r.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  protected parseJsonContent<T>(content: string): T {
    // Strip <think>...</think> blocks (Qwen3 / deepseek-r1 thinking models)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    // Strip markdown fences
    cleaned = cleaned
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    // Extract first JSON object/array if there's surrounding text
    const objStart = cleaned.indexOf("{");
    const objEnd = cleaned.lastIndexOf("}");
    if (objStart !== -1 && objEnd > objStart) {
      cleaned = cleaned.slice(objStart, objEnd + 1);
    }
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Attempt repair: common local-LLM JSON issues
      const repaired = this.repairJson(cleaned);
      try {
        return JSON.parse(repaired) as T;
      } catch (e2) {
        throw new Error(
          `local LLM returned non-JSON content: ${(e2 as Error).message}\n--- first 2000 chars ---\n${cleaned.slice(0, 2000)}`,
        );
      }
    }
  }

  /**
   * Attempt to fix common JSON errors from local LLMs:
   * - Unescaped newlines inside string values
   * - Trailing commas before } or ]
   * - Single quotes instead of double quotes (outside of values)
   * - Unescaped control chars
   */
  private repairJson(raw: string): string {
    let s = raw;
    // Fix unescaped newlines/tabs inside string values
    s = s.replace(/(:\s*")([\s\S]*?)("(?:\s*[,}\]]))/g, (_match, pre, val, post) => {
      const escaped = val
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/(?<!\\)"/g, '\\"');
      return `${pre}${escaped}${post}`;
    });
    // Trailing commas
    s = s.replace(/,\s*([}\]])/g, "$1");
    // Control characters that break JSON
    s = s.replace(/[\x00-\x1f]/g, (c) => {
      if (c === "\n" || c === "\r" || c === "\t") return c; // already handled
      return `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
    });
    return s;
  }

  protected systemSynthesisPrompt() {
    return SYNTHESIS_SYSTEM_PROMPT;
  }
  protected systemAnalysisPrompt() {
    return PER_ARTICLE_SYSTEM_PROMPT;
  }
  protected userSynthesisPrompt(c: string, a: ArticleInput[], o: SynthOpts) {
    return buildSynthesisUserPrompt(c, a, o);
  }
  protected userAnalysisPrompt(a: ArticleInput) {
    return buildPerArticleUserPrompt(a);
  }
  protected synthTimeout() {
    return SYNTH_TIMEOUT_MS;
  }
  protected analyzeTimeout() {
    return ANALYZE_TIMEOUT_MS;
  }
  protected embedTimeout() {
    return EMBED_TIMEOUT_MS;
  }
}
