import { NextResponse } from "next/server";
import { runIngest } from "@/lib/pipeline/ingest";

export async function POST() {
  try {
    const stats = await runIngest();
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
