import { notFound } from "next/navigation";
import { getStoryCardsForSection } from "@/lib/fixtures/stories";
import { StoryCard } from "@/components/stories/StoryCard";

const VALID_SECTIONS = new Set(["world", "us", "business", "markets", "tech", "culture"]);

const SECTION_TITLE: Record<string, string> = {
  world: "World",
  us: "U.S.",
  business: "Business",
  markets: "Markets",
  tech: "Tech",
  culture: "Culture",
};

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  return Array.from(VALID_SECTIONS).map((name) => ({ name }));
}

export default async function SectionPage({ params }: PageProps) {
  const { name } = await params;
  if (!VALID_SECTIONS.has(name)) notFound();
  const cards = getStoryCardsForSection(name);

  return (
    <main className="verity-main">
      <section className="lead-rail">
        <div className="lead-eyebrow">Section</div>
        <h2 className="lead-headline">{SECTION_TITLE[name]}</h2>
        <p className="lead-deck">
          Compiled stories in this section, refreshed hourly from whitelisted
          outlets covering {SECTION_TITLE[name]}.
        </p>
        <div className="mt-6">
          {cards.length === 0 ? (
            <p>No compiled stories in this section yet. Check back shortly.</p>
          ) : (
            cards.map((c) => <StoryCard key={c.slug} card={c} />)
          )}
        </div>
      </section>
      <aside className="side-rail" aria-label="About this section">
        <div className="side-eyebrow">About</div>
        <p>
          A section landing in Hermes is a thin index over the most recent
          compiled stories whose primary topic falls into this section. Section
          assignment is performed by the synthesis prompt at compile time and
          can be overridden by the editor.
        </p>
      </aside>
    </main>
  );
}
