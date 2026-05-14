import type { CSSProperties } from "react";
import type { DisagreementBlock } from "@/lib/types/story";

export function DisagreementCallout({ block }: { block: DisagreementBlock }) {
  return (
    <aside
      className="callout"
      role="note"
      aria-label={block.label ?? "Sources disagree"}
      style={{ columnSpan: "all" } as CSSProperties}
    >
      <div className="callout-label">{block.label ?? "Sources Disagree"}</div>
      <p className="callout-desc">{block.description}</p>
      <ul className="callout-list">
        {block.bullets.map((b, i) => (
          <li key={i}>
            <b>{b.sources.join(" and ")}</b> {b.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
