import type { ArticleInput, SynthesisResponse } from "./llm/types";

const CITE_MARKER_RE = /\[\^[^\]]+\]/;

export interface ValidationResult {
  ok: boolean;
  failures: string[];
}

export function validateSynthesis(
  resp: SynthesisResponse,
  articles: ArticleInput[],
  whitelistedDomains: Set<string>,
): ValidationResult {
  const failures: string[] = [];

  if (!resp.body) {
    failures.push("synthesis response missing body field");
    return { ok: false, failures };
  }

  // Warn if no citation markers but don't fail — local models often skip them
  if (!CITE_MARKER_RE.test(resp.body)) {
    console.warn("[postprocess] body has no [^domain] citation markers");
  }

  // Domain checks — keep strict: only cited domains that are on the whitelist
  // and were actually in the article set are allowed
  const articleDomains = new Set(articles.map((a) => a.domain.toLowerCase()));
  const allCited = new Set<string>();
  for (const c of resp.claimAttributions ?? []) {
    for (const d of c.attributedDomains) allCited.add(d.toLowerCase());
  }
  for (const d of resp.sourceDomains ?? []) allCited.add(d.toLowerCase());
  for (const d of allCited) {
    if (!whitelistedDomains.has(d)) {
      failures.push(`cited domain not on whitelist: ${d}`);
    } else if (!articleDomains.has(d)) {
      failures.push(`cited domain not in this synthesis's article set: ${d}`);
    }
  }

  return { ok: failures.length === 0, failures };
}
