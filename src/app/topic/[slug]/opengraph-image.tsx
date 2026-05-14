import { ImageResponse } from "next/og";
import { readCompiledStory } from "@/lib/stories/read";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hermes — Compiled Story";

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await readCompiledStory(slug);
  if (!story) {
    return new ImageResponse(<Fallback />, size);
  }
  const sourceLine = story.sources.map((s) => s.displayName).join(" · ");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f7f3eb",
          color: "#161412",
          padding: 64,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#4a423a",
            borderBottom: "4px double #1a1714",
            paddingBottom: 12,
          }}
        >
          <span>HERMES</span>
          <span>Journal Trader Intelligence</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#7a1d1d",
            }}
          >
            Compiled from {story.sources.length} outlets
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
            {story.headline}
          </div>
          <div
            style={{
              fontSize: 28,
              fontStyle: "italic",
              color: "#4a423a",
              lineHeight: 1.25,
            }}
          >
            {story.deck}
          </div>
        </div>
        <div
          style={{
            fontSize: 18,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#4a423a",
            borderTop: "4px double #1a1714",
            paddingTop: 12,
          }}
        >
          {sourceLine}
        </div>
      </div>
    ),
    size,
  );
}

function Fallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#f7f3eb",
        color: "#161412",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Georgia, serif",
        fontSize: 96,
        fontWeight: 900,
      }}
    >
      HERMES
    </div>
  );
}
