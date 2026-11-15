import { NextResponse } from "next/server";
import { getBug, getLevel } from "@/lib/data";
import { inWindow, readToken, schedule } from "@/lib/arcade";

// POST /api/game/[bugId]/whack { token, spawn }: was that ghost really a bug? Only answers while it is out of its hole.
export async function POST(req: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  const level = bug && (await getLevel(bug.id));
  if (!bug || !level) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { token, spawn } = await req.json().catch(() => ({}));
  const t = readToken(token, bug.id);
  const sp = t && schedule(level, t.seed).find((s) => s.id === spawn);
  if (!t || !sp) return NextResponse.json({ error: "bad round" }, { status: 400 });
  if (!inWindow(sp, t.startMs)) return NextResponse.json({ error: "too early or too late" }, { status: 400 });
  return NextResponse.json({ bug: sp.bug });
}
