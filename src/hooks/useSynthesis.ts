"use client";

import { useState } from "react";
import type { CompileMode } from "@/lib/constants";

export interface SynthesisRequest {
  mode: CompileMode;
  query?: string;
  headline?: string;
  urls?: string[];
  domains?: string[];
}

export interface SynthesisCachedMeta {
  hit: boolean;
  age_seconds: number;
}

export interface SynthesisResult {
  story: { id: string; slug: string };
  cached: SynthesisCachedMeta;
  response: unknown;
}

export function useSynthesis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SynthesisResult | null>(null);

  async function synthesize(req: SynthesisRequest): Promise<SynthesisResult | null> {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        throw new Error(json.error ?? `synthesis failed (${r.status})`);
      }
      const out: SynthesisResult = {
        story: json.story,
        cached: json.cached ?? { hit: false, age_seconds: 0 },
        response: json.response,
      };
      setResult(out);
      return out;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { synthesize, loading, error, result };
}
