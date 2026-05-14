import Link from "next/link";
import type { StoryCardData } from "@/lib/types/story";

const SECTION_LABEL: Record<StoryCardData["section"], string> = {
  world: "World",
  us: "U.S.",
  business: "Business",
  markets: "Markets",
  tech: "Tech",
  culture: "Culture",
};

export function StoryCard({ card }: { card: StoryCardData }) {
  const sourceCount = card.sourceNames.length;
  return (
    <article className="card">
      <span className="card-tag">
        {SECTION_LABEL[card.section]} &middot; {sourceCount} source
        {sourceCount === 1 ? "" : "s"}
        {card.singleSource ? (
          <>
            {" "}
            &middot; <span className="text-accent">Single-source flagged</span>
          </>
        ) : null}
      </span>
      <h3 className="card-headline">
        <Link href={`/topic/${card.slug}`} className="no-underline">
          {card.headline}
        </Link>
      </h3>
      <p className="card-blurb">{card.blurb}</p>
      <div className="card-sources">{card.sourceNames.join(" · ")}</div>
    </article>
  );
}
