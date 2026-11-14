import { NextResponse } from "next/server";
import { startScan } from "@/lib/pipeline";

export async function POST(req: Request) {
  const { repoUrl } = await req.json().catch(() => ({}));
  if (typeof repoUrl !== "string") return NextResponse.json({ error: "repoUrl required" }, { status: 400 });
  try {
    return NextResponse.json(await startScan(repoUrl));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
