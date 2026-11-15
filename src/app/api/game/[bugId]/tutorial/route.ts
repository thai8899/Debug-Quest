import { NextResponse } from "next/server";
import { getBug, unlockBug } from "@/lib/data";
import { getOrMakeLevel } from "@/lib/game";
import { TUTORIAL_AFTER, failCount, reviewOf } from "@/lib/arcade";
import { recordXpEvent } from "@/lib/xp";

// POST /api/game/[bugId]/tutorial: after 5 failed rounds the player may study the fix instead.
// It unlocks the fix but earns no XP and no stars. Before 5 fails the server refuses.
export async function POST(_: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const level = await getOrMakeLevel(bug);
  if (bug.locked) {
    const n = failCount(bug.id);
    if (n < TUTORIAL_AFTER) return NextResponse.json({ error: "tutorial locked", fails: n, needed: TUTORIAL_AFTER }, { status: 403 });
    await unlockBug(bug.id);
    await recordXpEvent({ userId: "demo", event: "hint_used", bugCategory: bug.category, xp: 0 });
    await recordXpEvent({ userId: "demo", event: "bug_unlocked", bugCategory: bug.category, xp: 0 });
  }
  return NextResponse.json({ bug: await getBug(bug.id), review: reviewOf(level) });
}
