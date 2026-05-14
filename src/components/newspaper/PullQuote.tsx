import type { CSSProperties, ReactNode } from "react";

interface PullQuoteProps {
  attribution?: string;
  children: ReactNode;
}

export function PullQuote({ attribution, children }: PullQuoteProps) {
  return (
    <aside
      className="my-4 border-y-2 border-accent bg-callout-bg px-5 py-4 text-center"
      style={{ columnSpan: "all" } as CSSProperties}
    >
      <p className="font-display text-2xl font-bold italic leading-snug text-ink">
        &ldquo;{children}&rdquo;
      </p>
      {attribution ? (
        <p className="mt-2 font-mono text-eyebrow uppercase tracking-eyebrow text-ink-soft">
          — {attribution}
        </p>
      ) : null}
    </aside>
  );
}
