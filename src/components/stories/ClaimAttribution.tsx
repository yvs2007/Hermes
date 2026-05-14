import { getSourceByDomain } from "@/lib/source-whitelist";

interface ClaimAttributionProps {
  domains: string[];
  /** When true, renders the accent-red "single source" treatment. */
  single?: boolean;
}

/**
 * The inline citation chip rendered between sentences. Renders as e.g.
 * `[reuters,ap,wsj]` in monospace, dotted-underlined, with a tooltip listing
 * the full outlet display names.
 */
export function ClaimAttribution({ domains, single }: ClaimAttributionProps) {
  const labels = domains.map((d) => shortLabel(d));
  const fullNames = domains
    .map((d) => getSourceByDomain(d)?.displayName ?? d)
    .join(", ");
  return (
    <span className={`cite${single ? " cite-single" : ""}`} title={fullNames}>
      [{labels.join(",")}]
    </span>
  );
}

function shortLabel(domain: string): string {
  switch (domain) {
    case "reuters.com":
      return "reuters";
    case "apnews.com":
      return "ap";
    case "bbc.com":
      return "bbc";
    case "nytimes.com":
      return "nyt";
    case "washingtonpost.com":
      return "wapo";
    case "wsj.com":
      return "wsj";
    case "ft.com":
      return "ft";
    case "bloomberg.com":
      return "bloomberg";
    case "cnbc.com":
      return "cnbc";
    case "forbes.com":
      return "forbes";
    case "businessinsider.com":
      return "bi";
    case "theguardian.com":
      return "guardian";
    case "aljazeera.com":
      return "aljazeera";
    case "dw.com":
      return "dw";
    case "france24.com":
      return "france24";
    case "nhk.or.jp":
      return "nhk";
    case "afp.com":
      return "afp";
    case "npr.org":
      return "npr";
    case "usatoday.com":
      return "usatoday";
    default:
      return domain.replace(/\.[^.]+$/, "");
  }
}
