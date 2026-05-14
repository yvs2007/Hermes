import type { SourceRef } from "@/lib/types/source";
import { SourceChip } from "@/components/stories/SourceChip";

interface SourceStripProps {
  sources: SourceRef[];
}

export function SourceStrip({ sources }: SourceStripProps) {
  return (
    <section className="source-strip" aria-label="Source citations">
      <div className="source-strip-label">
        Sources &middot; click to read the original reporting
      </div>
      <div className="chips">
        {sources.map((s) => (
          <SourceChip key={s.domain} source={s} />
        ))}
      </div>
    </section>
  );
}
