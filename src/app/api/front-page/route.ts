import { NextResponse } from "next/server";
import { runFrontPage } from "@/lib/pipeline/front-page";

export async function POST() {
  try {
    const stats = await runFrontPage();
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, stats: null },
      { status: 500 },
    );
  }
}
