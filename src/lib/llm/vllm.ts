import { LocalLLMBase } from "./local-base";
import type {
  ArticleAnalysis,
  ArticleInput,
  SynthOpts,
  SynthesisResponse,
} from "./types";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}
interface OpenAIEmbedResponse {
  data?: Array<{ embedding?: number[] }>;
}

export class VLLMProvider extends LocalLLMBase {
  readonly name = "vllm";

  async synthesize(
    canonicalTitle: string,
    articles: ArticleInput[],
    opts: SynthOpts,
  ): Promise<SynthesisResponse> {
    const r = await this.post<OpenAIChatResponse>(
      "/v1/chat/completions",
      {
        model: this.cfg.synthModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: this.systemSynthesisPrompt() },
          { role: "user", content: this.userSynthesisPrompt(canonicalTitle, articles, opts) },
        ],
      },
      this.synthTimeout(),
    );
    return this.parseJsonContent<SynthesisResponse>(
      r.choices?.[0]?.message?.content ?? "",
    );
  }

  async analyzeArticle(article: ArticleInput): Promise<ArticleAnalysis> {
    const r = await this.post<OpenAIChatResponse>(
      "/v1/chat/completions",
      {
        model: this.cfg.analyzeModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: this.systemAnalysisPrompt() },
          { role: "user", content: this.userAnalysisPrompt(article) },
        ],
      },
      this.analyzeTimeout(),
    );
    return this.parseJsonContent<ArticleAnalysis>(
      r.choices?.[0]?.message?.content ?? "",
    );
  }

  async embed(text: string): Promise<number[]> {
    const r = await this.post<OpenAIEmbedResponse>(
      "/v1/embeddings",
      { model: this.cfg.embedModel, input: text.slice(0, 8000) },
      this.embedTimeout(),
    );
    const v = r.data?.[0]?.embedding;
    if (!v) throw new Error("vllm embeddings: missing `data[0].embedding` field");
    return v;
  }
}
