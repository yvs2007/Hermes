export const REUSE_TOPIC_HEADLINE_WINDOW_HOURS = 24;
export const REUSE_LINKS_COMPARE_WINDOW_HOURS = 12;
export const REUSE_COSINE_THRESHOLD = 0.88;
export const REGENERATE_NEW_ARTICLES = 3;
export const REGENERATE_AGE_HOURS = 6;

export async function linksHash(urls: string[]): Promise<string> {
  const normalized = Array.from(
    new Set(urls.map((u) => normalizeUrl(u)).filter(Boolean) as string[]),
  ).sort();
  return sha256Hex(normalized.join("\n"));
}

export async function compareHash(topic: string, domains: string[]): Promise<string> {
  const normTopic = topic.trim().replace(/\s+/g, " ").toLowerCase();
  const normDomains = Array.from(
    new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)),
  ).sort();
  return sha256Hex(`${normTopic}\u241F${normDomains.join("\n")}`);
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    const drop = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "fbclid", "gclid", "ref", "ref_src",
    ];
    for (const k of drop) u.searchParams.delete(k);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    const search = u.searchParams.toString();
    return `${u.protocol}//${host}${path}${search ? `?${search}` : ""}`;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface RegenerateInput {
  refreshedAt: Date;
  newArticleCount: number;
  hasAnyNewArticle: boolean;
  now?: Date;
}

export function shouldRegenerate(input: RegenerateInput): boolean {
  const now = input.now ?? new Date();
  if (input.newArticleCount >= REGENERATE_NEW_ARTICLES) return true;
  const ageHours = (now.getTime() - input.refreshedAt.getTime()) / 3600_000;
  if (ageHours >= REGENERATE_AGE_HOURS && input.hasAnyNewArticle) return true;
  return false;
}
