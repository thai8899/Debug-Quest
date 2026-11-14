import { NextResponse } from "next/server";
import { getBug, getQuiz } from "@/lib/data";
import { recordXpEvent } from "@/lib/xp";

export async function POST(req: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  const quiz = bug && (await getQuiz(bug.id));
  const { questionIndex } = await req.json().catch(() => ({}));
  const q = quiz?.questions[questionIndex];
  if (!bug || !q) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordXpEvent({ userId: "demo", event: "hint_used", bugCategory: bug.category, xp: 0 });
  return NextResponse.json({ hint: q.hint });
}
