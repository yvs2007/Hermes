import type { SourceRef, BiasRating } from "@/lib/types/source";

const BIAS_LABEL: Record<BiasRating, string> = {
  "far-left": "Far Left",
  left: "Left",
  "center-left": "Center-Left",
  center: "Center",
  "center-right": "Center-Right",
  right: "Right",
  "far-right": "Far Right",
  indeterminate: "Indeterminate",
};

export function SourceChip({ source }: { source: SourceRef }) {
  const inner = (
    <>
      <div className="chip-name">{source.displayName}</div>
      <div className="chip-meta">
        Bias <b>{BIAS_LABEL[source.bias]}</b> &middot; Credibility{" "}
        <b>{source.credibility}</b>
      </div>
    </>
  );

  if (source.articleUrl) {
    return (
      <a
        className="chip"
        href={source.articleUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {inner}
      </a>
    );
  }
  return <div className="chip">{inner}</div>;
}
