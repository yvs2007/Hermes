import { NextResponse, type NextRequest } from "next/server";
import { suggestTopics } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  const rows = suggestTopics(q, 8);
  return NextResponse.json({
    suggestions: rows.map((r) => ({
      title: r.title,
      source: r.source_domain,
    })),
  });
}
