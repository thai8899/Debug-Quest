import { NextResponse } from "next/server";
import { getBug, getLevel, unlockBug } from "@/lib/data";
import { runLevel } from "@/lib/game";
import { recordXpEvent } from "@/lib/xp";

// POST /api/game/[bugId]/run { placements: { [stationId]: guardId }, secondsToSolve }
// The server simulates the run and decides pass or fail. Fails reveal only where the bot crashed.
export async function POST(req: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  const level = bug && (await getLevel(bug.id));
  if (!bug || !level) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { placements, secondsToSolve } = await req.json().catch(() => ({}));
  const out = runLevel(level, placements);
  if ("error" in out) return NextResponse.json(out, { status: 400 });
  const { result } = out;

  if (!result.passed) {
    await recordXpEvent({ userId: "demo", event: "quiz_fail", bugCategory: bug.category, xp: 0, secondsToSolve });
    return NextResponse.json(result);
  }
  const firstTime = bug.locked;
  if (firstTime) {
    await unlockBug(bug.id);
    await recordXpEvent({ userId: "demo", event: "quiz_pass", bugCategory: bug.category, xp: result.xpEarned, secondsToSolve });
    await recordXpEvent({ userId: "demo", event: "bug_unlocked", bugCategory: bug.category, xp: 0 });
  }
  return NextResponse.json({ ...result, xpEarned: firstTime ? result.xpEarned : 0, bug: await getBug(bug.id) });
}
