import { NextResponse } from "next/server";
import { sendNtfyAlert } from "@/lib/notify";

export async function POST(request: Request) {
  let repoName = "";
  let bugCount = 0;
  let scanUrl = "";

  try {
    const body = await request.json();
    repoName = typeof body.repoName === "string" ? body.repoName : "";
    bugCount = Number(body.bugCount) || 0;
    scanUrl = typeof body.scanUrl === "string" ? body.scanUrl : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!repoName || !scanUrl) {
    return NextResponse.json(
      { error: "repoName and scanUrl are required" },
      { status: 400 }
    );
  }

  // Never let ntfy failures surface as a 500 — alerts are best-effort.
  await sendNtfyAlert({ repoName, bugCount, scanUrl });
  return NextResponse.json({ ok: true });
}
