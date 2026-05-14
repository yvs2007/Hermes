import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StoryView, MarketImpactFooter } from "@/components/stories/StoryView";
import { StoryCard } from "@/components/stories/StoryCard";
import { readCompiledStory, readFrontPage } from "@/lib/stories/read";
import { COMPILED_STORIES } from "@/lib/fixtures/stories";
import { SITE_NAME } from "@/lib/constants";

export const revalidate = 1800; // 30 min, matches CDN cache for compiled stories

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Fixture slugs only — DB-resident stories are rendered on-demand and
  // cached per `revalidate`.
  return Object.keys(COMPILED_STORIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await readCompiledStory(slug);
  if (!story) return { title: `Story not found — ${SITE_NAME}` };
  return {
    title: `${story.headline} — ${SITE_NAME}`,
    description: story.deck,
    openGraph: {
      title: story.headline,
      description: story.deck,
      type: "article",
    },
    twitter: { card: "summary_large_image", title: story.headline, description: story.deck },
  };
}

function newsArticleJsonLd(story: NonNullable<Awaited<ReturnType<typeof readCompiledStory>>>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.headline,
    description: story.deck,
    datePublished: story.refreshedAt,
    dateModified: story.refreshedAt,
    author: { "@type": "Organization", name: "Hermes" },
    publisher: { "@type": "Organization", name: "Hermes" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/topic/${story.slug}` },
    isBasedOn: story.sources.map((s) => ({
      "@type": "NewsArticle",
      publisher: { "@type": "Organization", name: s.displayName, url: `https://${s.domain}` },
    })),
  };
}

export default async function TopicPage({ params }: PageProps) {
  const { slug } = await params;
  const story = await readCompiledStory(slug);
  if (!story) notFound();
  const { side } = await readFrontPage();
  const jsonLd = newsArticleJsonLd(story);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="verity-main">
        <StoryView story={story} />
        <aside className="side-rail" aria-label="Related compiled stories">
          <div className="side-eyebrow">Related Compiled Stories</div>
          {side.map((c) => (
            <StoryCard key={c.slug} card={c} />
          ))}
        </aside>
      </main>
      <MarketImpactFooter impacts={story.marketImpacts} />
    </>
  );
}
