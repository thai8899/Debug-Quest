import { NextResponse } from "next/server";
import { getBug } from "@/lib/data";
import { getOrMakeLevel } from "@/lib/game";
import { toPublicLevel } from "@/lib/levelTypes";

// GET /api/game/[bugId]: the board for this bug. No hazards, no answers.
export async function GET(_: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const level = await getOrMakeLevel(bug);
  return NextResponse.json({
    bugId: bug.id, scanId: bug.scanId, file: bug.file, category: bug.category, severity: bug.severity,
    unlocked: !bug.locked, bug: bug.locked ? undefined : bug, ...toPublicLevel(level),
  });
}
