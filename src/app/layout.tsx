import type { Metadata } from "next";
import "./globals.css";
import { Masthead } from "@/components/newspaper/Masthead";
import { TopicSearchBar } from "@/components/search/TopicSearchBar";
import { AutoPipeline } from "@/components/AutoPipeline";
import { SOURCE_WHITELIST } from "@/lib/source-whitelist";
import { SITE_NAME, SITE_NAMEPLATE_SUB } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_NAMEPLATE_SUB}`,
  description:
    "Hermes compiles one synthesized story per topic from a curated whitelist of trusted news outlets, with every claim attributed and disagreements surfaced.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: `${SITE_NAME} — ${SITE_NAMEPLATE_SUB}`,
    description:
      "One compiled story per topic from a curated whitelist of trusted outlets.",
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const outletCount = SOURCE_WHITELIST.length;
  return (
    <html lang="en">
      <body>
        <Masthead outletCount={outletCount} />
        <div className="compose-row">
          <TopicSearchBar />
        </div>
        {children}
        <AutoPipeline />
        <footer className="verity-footer">
          {SITE_NAME} is a synthesis newspaper. We do not generate news. We
          compile it from {outletCount} whitelisted outlets and cite every claim.
          &middot; <a href="/how-it-works">Methodology</a> &middot;{" "}
          <a href="/settings">Settings</a>
        </footer>
      </body>
    </html>
  );
}
