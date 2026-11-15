import { NextResponse } from "next/server";
import { startScan } from "@/lib/pipeline";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { repoUrl, liveUrl } = body as { repoUrl?: unknown; liveUrl?: unknown };
  if (typeof repoUrl !== "string") return NextResponse.json({ error: "repoUrl required" }, { status: 400 });
  const live =
    typeof liveUrl === "string" && liveUrl.trim() ? liveUrl.trim() : undefined;
  try {
    return NextResponse.json(await startScan(repoUrl, live));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
