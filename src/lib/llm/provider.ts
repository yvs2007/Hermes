import type {
  ArticleInput,
  SynthOpts,
  SynthesisResponse,
  ArticleAnalysis,
} from "./types";
import { getSetting } from "../db/queries";

export interface LLMProvider {
  name: string;
  modelVersion: string;
  synthesize(
    canonicalTitle: string,
    articles: ArticleInput[],
    opts: SynthOpts,
  ): Promise<SynthesisResponse>;
  analyzeArticle(article: ArticleInput): Promise<ArticleAnalysis>;
  embed(text: string): Promise<number[]>;
}

/**
 * Build a provider from user settings (SQLite) with env-var fallback.
 * Settings keys:
 *   llm_provider   = "ollama" | "openai" | "anthropic" | "vllm"
 *   llm_api_key    = API key for openai/anthropic
 *   llm_base_url   = Base URL for ollama/vllm (default: http://localhost:11434)
 *   llm_synth_model    = model name for synthesis
 *   llm_analyze_model  = model name for per-article analysis
 *   llm_embed_model    = model name for embeddings
 */
export function getConfiguredProvider(): LLMProvider {
  const kind = (getSetting("llm_provider") ?? process.env.LLM_PROVIDER_KIND ?? "ollama").toLowerCase();
  const apiKey = getSetting("llm_api_key") ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
  const baseUrl = getSetting("llm_base_url") ?? process.env.LLM_BASE_URL ?? "http://localhost:11434";
  const synthModel = getSetting("llm_synth_model") ?? process.env.LLM_SYNTHESIS_MODEL;
  const analyzeModel = getSetting("llm_analyze_model") ?? process.env.LLM_ANALYSIS_MODEL;
  const embedModel = getSetting("llm_embed_model") ?? process.env.LLM_EMBEDDING_MODEL;

  if (kind === "anthropic") {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Anthropic API key is required. Configure it in Settings.");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AnthropicProvider } = require("./anthropic") as typeof import("./anthropic");
    return new AnthropicProvider(key);
  }

  if (kind === "openai") {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI API key is required. Configure it in Settings.");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAIProvider } = require("./openai") as typeof import("./openai");
    return new OpenAIProvider(key);
  }

  // Local providers: ollama or vllm
  const cfg = {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    bearerToken: process.env.LLM_BEARER_TOKEN ?? null,
    synthModel: synthModel ?? (kind === "vllm" ? "deepseek-r1-distill-qwen-32b" : "deepseek-r1-distill-qwen-32b"),
    analyzeModel: analyzeModel ?? "gemma3:4b",
    embedModel: embedModel ?? "nomic-embed-text",
  };

  if (kind === "vllm") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { VLLMProvider } = require("./vllm") as typeof import("./vllm");
    return new VLLMProvider(cfg);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { OllamaProvider } = require("./ollama") as typeof import("./ollama");
  return new OllamaProvider(cfg);
}

/**
 * Run synthesis through the configured provider.
 */
export async function synthesizeWithProvider(
  canonicalTitle: string,
  articles: ArticleInput[],
  opts: SynthOpts,
): Promise<{ provider: LLMProvider; response: SynthesisResponse }> {
  const p = getConfiguredProvider();
  const response = await p.synthesize(canonicalTitle, articles, opts);
  return { provider: p, response };
}

/**
 * Run embedding through the configured provider.
 */
export async function embedWithProvider(text: string): Promise<number[]> {
  const p = getConfiguredProvider();
  return p.embed(text);
}
