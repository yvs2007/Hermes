import { notFound } from "next/navigation";
import Link from "next/link";
import { getSourceByDomain, SOURCE_WHITELIST } from "@/lib/source-whitelist";

interface PageProps {
  params: Promise<{ domain: string }>;
}

export async function generateStaticParams() {
  return SOURCE_WHITELIST.map((s) => ({ domain: s.domain }));
}

export default async function SourcePage({ params }: PageProps) {
  const { domain } = await params;
  const source = getSourceByDomain(decodeURIComponent(domain));
  if (!source) notFound();

  return (
    <main className="verity-prose">
      <div className="lead-eyebrow">Source profile</div>
      <h1>{source.displayName}</h1>
      <p>
        <b>Domain:</b> {source.domain}
        {source.aliases.length > 0 ? ` (also ${source.aliases.join(", ")})` : null}
        <br />
        <b>Category:</b> {source.category}
        <br />
        <b>Bias baseline:</b> {source.biasBaseline}
        <br />
        <b>Credibility baseline:</b> {source.credibilityBaseline}
        <br />
        <b>Factual reporting:</b> {source.factualReporting}
      </p>
      {source.notes ? (
        <>
          <h2>Notes</h2>
          <p>{source.notes}</p>
        </>
      ) : null}
      <h2>RSS feeds</h2>
      {source.rssFeeds.length === 0 ? (
        <p>No public RSS feeds configured.</p>
      ) : (
        <ul>
          {source.rssFeeds.map((url) => (
            <li key={url}>
              <code style={{ wordBreak: "break-all" }}>{url}</code>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/how-it-works">How Hermes uses sources</Link>
      </p>
    </main>
  );
}
