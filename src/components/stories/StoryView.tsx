import { Fragment } from "react";
import type { BodyBlock, BodyParagraph, CompiledStory } from "@/lib/types/story";
import type { MarketImpact } from "@/lib/llm/types";
import { ClaimAttribution } from "@/components/stories/ClaimAttribution";
import { DisagreementCallout } from "@/components/newspaper/DisagreementCallout";
import { MultiColumn } from "@/components/newspaper/MultiColumn";
import { SourceStrip } from "@/components/stories/SourceStrip";
import { formatRefreshedAt } from "@/lib/utils";

export function StoryView({ story }: { story: CompiledStory }) {
  return (
    <article className="lead-rail">
      <div className="lead-eyebrow">
        Lead Story &middot; Compiled from {story.sources.length} outlets
      </div>
      <h2 className="lead-headline">{story.headline}</h2>
      <p className="lead-deck">{story.deck}</p>
      <p className="byline">
        {story.byline} &middot; Refreshed {formatRefreshedAt(story.refreshedAt)}
      </p>
      {story.singleSource ? (
        <p className="single-source-banner" role="note">
          This story is drawn from a single outlet and has not yet been
          corroborated elsewhere.
        </p>
      ) : null}

      <MultiColumn>
        {story.body.map((block, i) => (
          <BodyBlockRenderer key={i} block={block} />
        ))}
      </MultiColumn>

      <SourceStrip sources={story.sources} />
    </article>
  );
}

export function MarketImpactFooter({ impacts }: { impacts: MarketImpact[] }) {
  if (!impacts.length) return null;
  return (
    <footer className="market-footer" aria-label="Affected Stocks &amp; Predicted Outcomes">
      <MarketImpactPanel impacts={impacts} />
    </footer>
  );
}

function BodyBlockRenderer({ block }: { block: BodyBlock }) {
  if (block.kind === "disagreement") {
    return <DisagreementCallout block={block.block} />;
  }
  return <Paragraph paragraph={block.paragraph} />;
}

function Paragraph({ paragraph }: { paragraph: BodyParagraph }) {
  return (
    <p className={paragraph.dropCap ? "drop-cap" : undefined}>
      {paragraph.tokens.map((tok, i) => {
        if (tok.kind === "text") {
          return <Fragment key={i}>{tok.text}</Fragment>;
        }
        return <ClaimAttribution key={i} domains={tok.domains} single={tok.single} />;
      })}
      {paragraph.trailingNote ? (
        <>
          {" "}
          <em>{paragraph.trailingNote}</em>
        </>
      ) : null}
    </p>
  );
}

function scoreColor(score: number): string {
  if (score >= 20) return "#0a7c42";
  if (score > 0) return "#2d8a56";
  if (score === 0) return "#666";
  if (score > -20) return "#a14040";
  return "#7a1d1d";
}

function scoreLabel(score: number): string {
  const abs = Math.abs(score);
  if (abs <= 20) return "minor";
  if (abs <= 50) return "moderate";
  if (abs <= 80) return "significant";
  return "extreme";
}

function MarketImpactPanel({ impacts }: { impacts: MarketImpact[] }) {
  const sorted = [...impacts].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return (
    <section className="market-impact-panel" aria-label="Market Impact Analysis">
      <div className="market-impact-header">
        <span className="market-impact-label">Market Impact</span>
        <span className="market-impact-sublabel">
          {impacts.length} ticker{impacts.length === 1 ? "" : "s"} affected
        </span>
      </div>
      <div className="market-impact-grid">
        {sorted.map((impact) => (
          <div key={impact.ticker} className="market-impact-card">
            <div className="impact-card-top">
              <span className="impact-ticker">{impact.ticker}</span>
              <span
                className="impact-score"
                style={{ color: scoreColor(impact.score) }}
              >
                {impact.score > 0 ? "+" : ""}
                {impact.score}
              </span>
            </div>
            <div className="impact-company">{impact.company}</div>
            <div className="impact-meta">
              <span
                className={`impact-badge impact-badge-${impact.direction}`}
              >
                {impact.direction}
              </span>
              <span className="impact-magnitude">{scoreLabel(impact.score)}</span>
            </div>
            <div className="impact-reasoning">{impact.reasoning}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
