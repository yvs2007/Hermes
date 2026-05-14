import { StoryView, MarketImpactFooter } from "@/components/stories/StoryView";
import { StoryCard } from "@/components/stories/StoryCard";
import { readFrontPage } from "@/lib/stories/read";

export const revalidate = 300; // 5 min CDN cache (ARCHITECTURE.md)

export default async function FrontPage() {
  const { lead, side } = await readFrontPage();
  return (
    <>
      <main className="verity-main">
        <StoryView story={lead} />
        <aside className="side-rail" aria-label="Also compiled today">
          <div className="side-eyebrow">Also Compiled Today</div>
          {side.map((c) => (
            <StoryCard key={c.slug} card={c} />
          ))}
        </aside>
      </main>
      <MarketImpactFooter impacts={lead.marketImpacts} />
    </>
  );
}
