import { SOURCE_WHITELIST } from "@/lib/source-whitelist";
import { SITE_NAME } from "@/lib/constants";

export const metadata = {
  title: "How It Works — Hermes",
  description:
    "How Hermes ingests, clusters, and synthesizes news from a curated whitelist of trusted outlets.",
};

export default function HowItWorksPage() {
  const wires = SOURCE_WHITELIST.filter((s) => s.category === "wire");
  const usNational = SOURCE_WHITELIST.filter((s) => s.category === "us-national");
  const intl = SOURCE_WHITELIST.filter((s) => s.category === "international");
  const business = SOURCE_WHITELIST.filter((s) => s.category === "business");

  return (
    <main className="verity-prose">
      <h1>How {SITE_NAME} Works</h1>
      <p>
        {SITE_NAME} is a synthesis newspaper. We do not generate news. We
        ingest reporting from a curated whitelist of trusted outlets, group
        articles that cover the same event into topic clusters, and use a large
        language model to compile one consolidated story per cluster — with
        every claim attributed and every disagreement surfaced.
      </p>

      <h2>The pipeline</h2>
      <ul>
        <li>
          <b>Ingest.</b> Every 15 minutes, Hermes polls RSS feeds for {SOURCE_WHITELIST.length}{" "}
          whitelisted outlets. Any URL that doesn&rsquo;t resolve to a whitelisted
          domain is rejected before it touches storage.
        </li>
        <li>
          <b>Extract.</b> Article HTML is parsed by Mozilla Readability into a
          clean body, hashed, and dedup&rsquo;d.
        </li>
        <li>
          <b>Cluster.</b> Articles are embedded and grouped by cosine similarity
          against recent clusters; new events spawn new clusters.
        </li>
        <li>
          <b>Synthesize.</b> When a cluster grows or a user requests it, the
          full text of every article in the cluster is sent to the LLM with a
          strict prompt: every claim must be attributed, disagreements must be
          surfaced, single-source claims must be flagged.
        </li>
        <li>
          <b>Validate.</b> A post-processor checks that every paragraph has at
          least one citation, that every cited domain is on the whitelist, and
          that every attributed claim text fuzzy-matches a passage in the
          source articles. If anything fails, the synthesis is regenerated
          once, then rejected.
        </li>
      </ul>

      <h2>Editorial principles</h2>
      <ul>
        <li>No claim appears in a compiled story unless at least one whitelisted outlet has published it.</li>
        <li>Every factual claim is attributed to its originating outlet(s).</li>
        <li>Disagreements between outlets are surfaced, not averaged away.</li>
        <li>Opinion and analysis pieces are clearly labeled and not blended with hard news.</li>
        <li>Pay-walled outlets are cited with whatever public excerpt is available; Hermes does not bypass paywalls.</li>
      </ul>

      <h2>Best practices</h2>
      <p>
        Getting the most out of {SITE_NAME} depends on how you frame your queries
        and manage your sources. Here are tips from our own usage:
      </p>

      <h3>Compiling stories</h3>
      <ul>
        <li>
          <b>Start broad, then narrow.</b> A broad query like &ldquo;tariffs&rdquo;
          pulls articles from many sources and gives you a wide, multi-perspective
          overview. Add specifics (&ldquo;US-China tariffs semiconductors 2026&rdquo;)
          to tighten coverage to fewer, more relevant outlets.
        </li>
        <li>
          <b>Run ingestion first.</b> Before compiling, hit &ldquo;Ingest Now&rdquo;
          in Settings to pull the latest articles. Stale data means missing
          perspectives.
        </li>
        <li>
          <b>Use &ldquo;Compare&rdquo; mode for bias detection.</b> When you want
          to see how different outlets frame the same event, select specific
          sources in Compare mode. This surfaces editorial framing differences
          that a standard synthesis might smooth over.
        </li>
        <li>
          <b>Paste links for breaking news.</b> If a story just broke and RSS
          hasn&rsquo;t caught up yet, paste 3&ndash;5 article URLs directly using
          Links mode. The system will extract, attribute, and synthesize them
          immediately.
        </li>
      </ul>

      <h3>Managing sources</h3>
      <ul>
        <li>
          <b>More active sources = better synthesis.</b> Each additional outlet
          that covers the same event gives the LLM another perspective to
          cross-reference. Deactivate sources only if they consistently produce
          noise for your use case.
        </li>
        <li>
          <b>Add niche sources for your domain.</b> If you trade energy stocks,
          add energy-focused outlets with RSS feeds in Settings. The more
          sector-specific your sources, the richer your market impact analysis.
        </li>
        <li>
          <b>Check bias ratings.</b> The source list shows bias and credibility
          baselines. A good mix includes center, center-left, and center-right
          outlets so the synthesis isn&rsquo;t skewed by one editorial lens.
        </li>
      </ul>

      <h3>Historical context (Wayback Machine)</h3>
      <ul>
        <li>
          <b>Use date ranges for developing stories.</b> If today&rsquo;s news is
          a development of something from months ago, use the Wayback search in
          Settings to pull archived articles from that earlier period. This gives
          the synthesis engine historical context it wouldn&rsquo;t otherwise have.
        </li>
        <li>
          <b>Good keywords help.</b> The Wayback search matches keywords in
          article URLs, so use specific terms (company names, policy names) rather
          than generic phrases.
        </li>
      </ul>

      <h3>Reading compiled stories</h3>
      <ul>
        <li>
          <b>Watch for single-source flags.</b> A claim tagged as single-source
          hasn&rsquo;t been corroborated by other outlets. Treat it with more
          skepticism until confirmed.
        </li>
        <li>
          <b>Check the disagreement callouts.</b> These are where outlets
          contradict each other on facts. They&rsquo;re often the most
          decision-relevant part of a story.
        </li>
        <li>
          <b>Use market impact scores as signals, not orders.</b> The ticker
          scores are LLM-generated interpretations of how markets might react.
          They reflect consensus analyst reasoning, not insider knowledge.
          Cross-reference with price action before acting.
        </li>
      </ul>

      <h2>The whitelist</h2>
      <p>
        Hermes reads from {SOURCE_WHITELIST.length} outlets across four
        categories. Bias and credibility baselines are refreshed quarterly from
        independent media-rating sources; per-article ratings can override the
        baseline for a specific story.
      </p>

      <h3>Major wires</h3>
      <p>{wires.map((s) => s.displayName).join(", ")}.</p>

      <h3>U.S. national</h3>
      <p>{usNational.map((s) => s.displayName).join(", ")}.</p>

      <h3>International</h3>
      <p>{intl.map((s) => s.displayName).join(", ")}.</p>

      <h3>Business</h3>
      <p>{business.map((s) => s.displayName).join(", ")}.</p>
    </main>
  );
}
