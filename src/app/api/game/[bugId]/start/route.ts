import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getBug } from "@/lib/data";
import { getOrMakeLevel } from "@/lib/game";
import { DURATION, LEAD, LIVES, isMode, makeToken, publicSpawns, schedule } from "@/lib/arcade";
import type { ArcadeStart } from "@/lib/levelTypes";

// POST /api/game/[bugId]/start { mode }: a fresh round. The schedule is public; which ghosts are bugs is not.
export async function POST(req: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const level = await getOrMakeLevel(bug);
  const { mode: m } = await req.json().catch(() => ({}));
  const mode = isMode(m) ? m : "chomp";
  const seed = randomInt(1, 2 ** 31 - 1);
  const startMs = Date.now() + LEAD;
  const spawns = schedule(level, seed, mode);
  const goal = Math.ceil(spawns.filter((s) => s.bug).length * 0.7);
  const body: ArcadeStart = { mode, token: makeToken(bug.id, seed, startMs, mode), durationMs: DURATION, leadMs: LEAD, lives: LIVES, goal, spawns: publicSpawns(level, spawns) };
  return NextResponse.json(body);
}
