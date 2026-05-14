import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    mode?: string;
    q?: string;
    urls?: string;
    domains?: string;
  }>;
}

const MODE_LABEL: Record<string, string> = {
  topic: "Topic",
  links: "Links",
  headline: "Headline",
  compare: "Compare",
};

export default async function ComposeLandingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const mode = sp.mode ?? "topic";
  const query = sp.q?.trim() ?? "";
  const urls = sp.urls?.trim() ?? "";
  const domains = sp.domains?.split(",").filter(Boolean) ?? [];

  return (
    <main className="verity-prose">
      <h1>Compiling&hellip;</h1>
      <p>
        Hermes received your <b>{MODE_LABEL[mode] ?? mode}</b> request. Use the
        Compile bar at the top of any page to synthesize stories from your
        configured LLM.
      </p>

      <h2>What you submitted</h2>
      <ul>
        <li>
          <b>Mode:</b> {MODE_LABEL[mode] ?? mode}
        </li>
        {query ? (
          <li>
            <b>Query:</b> {query}
          </li>
        ) : null}
        {urls ? (
          <li>
            <b>URLs:</b>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{urls}</pre>
          </li>
        ) : null}
        {domains.length > 0 ? (
          <li>
            <b>Restricted to:</b> {domains.join(", ")}
          </li>
        ) : null}
      </ul>

      <p>
        <Link href="/settings">Configure your LLM provider</Link> if you
        haven&rsquo;t already.
      </p>
    </main>
  );
}
