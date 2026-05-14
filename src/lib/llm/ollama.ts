import { LocalLLMBase } from "./local-base";
import type {
  ArticleAnalysis,
  ArticleInput,
  SynthOpts,
  SynthesisResponse,
} from "./types";

interface OllamaChatResponse {
  message?: { content?: string };
}
interface OllamaEmbedResponse {
  embedding?: number[];
}

export class OllamaProvider extends LocalLLMBase {
  readonly name = "ollama";

  async synthesize(
    canonicalTitle: string,
    articles: ArticleInput[],
    opts: SynthOpts,
  ): Promise<SynthesisResponse> {
    const r = await this.post<OllamaChatResponse>(
      "/api/chat",
      {
        model: this.cfg.synthModel,
        format: "json",
        stream: false,
        options: { temperature: 0.3 },
        messages: [
          { role: "system", content: this.systemSynthesisPrompt() },
          { role: "user", content: this.userSynthesisPrompt(canonicalTitle, articles, opts) },
        ],
      },
      this.synthTimeout(),
    );
    return this.parseJsonContent<SynthesisResponse>(r.message?.content ?? "");
  }

  async analyzeArticle(article: ArticleInput): Promise<ArticleAnalysis> {
    const r = await this.post<OllamaChatResponse>(
      "/api/chat",
      {
        model: this.cfg.analyzeModel,
        format: "json",
        stream: false,
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: this.systemAnalysisPrompt() },
          { role: "user", content: this.userAnalysisPrompt(article) },
        ],
      },
      this.analyzeTimeout(),
    );
    return this.parseJsonContent<ArticleAnalysis>(r.message?.content ?? "");
  }

  async embed(text: string): Promise<number[]> {
    const r = await this.post<OllamaEmbedResponse>(
      "/api/embeddings",
      { model: this.cfg.embedModel, prompt: text.slice(0, 8000) },
      this.embedTimeout(),
    );
    if (!r.embedding) throw new Error("ollama embeddings: missing `embedding` field");
    return r.embedding;
  }
}
