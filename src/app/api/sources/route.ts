import { NextResponse, type NextRequest } from "next/server";
import {
  getAllSources,
  setSourceActive,
  type SourceRow,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/connection";

export async function GET() {
  const sources = getAllSources();
  return NextResponse.json({ sources });
}

/** Toggle active state or add a new custom source */
export async function PUT(req: NextRequest) {
  const body = await req.json() as {
    action: "toggle" | "add";
    domain?: string;
    active?: boolean;
    source?: {
      domain: string;
      displayName: string;
      category: string;
      rssFeeds: string[];
      biasRating?: string;
      credibilityScore?: number;
      factualReporting?: string;
      notes?: string;
    };
  };

  if (body.action === "toggle" && body.domain != null && body.active != null) {
    setSourceActive(body.domain, body.active);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add" && body.source) {
    const s = body.source;
    const domain = s.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: "invalid domain" }, { status: 400 });
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO sources (domain, display_name, category, aliases, rss_feed_urls, bias_rating, credibility_score, factual_reporting, is_active, notes)
       VALUES (?, ?, ?, '[]', ?, ?, ?, ?, 1, ?)
       ON CONFLICT(domain) DO UPDATE SET
         display_name = excluded.display_name,
         rss_feed_urls = excluded.rss_feed_urls,
         bias_rating = excluded.bias_rating,
         credibility_score = excluded.credibility_score,
         factual_reporting = excluded.factual_reporting,
         notes = excluded.notes`,
    ).run(
      domain,
      s.displayName || domain,
      s.category || "business",
      JSON.stringify(s.rssFeeds || []),
      s.biasRating || "center",
      s.credibilityScore ?? 70,
      s.factualReporting || "mostly-factual",
      s.notes || "User-added source",
    );
    return NextResponse.json({ ok: true, domain });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}

/** Delete a custom source */
export async function DELETE(req: NextRequest) {
  const { domain } = await req.json() as { domain: string };
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const db = getDb();
  // Only allow deleting user-added sources (those with "User-added" in notes)
  const row = db.prepare("SELECT notes FROM sources WHERE domain = ?").get(domain) as SourceRow | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!row.notes?.includes("User-added")) {
    return NextResponse.json({ error: "cannot delete built-in sources, only deactivate them" }, { status: 403 });
  }
  db.prepare("DELETE FROM sources WHERE domain = ?").run(domain);
  return NextResponse.json({ ok: true });
}
