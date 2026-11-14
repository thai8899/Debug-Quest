import { NextResponse } from "next/server";
import { getBug } from "@/lib/data";
import { getOrMakeQuiz, toPublic } from "@/lib/quiz";

export async function GET(_: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const quiz = await getOrMakeQuiz(bug);
    return NextResponse.json({
      bugId: bug.id, scanId: bug.scanId, file: bug.file, category: bug.category, severity: bug.severity,
      unlocked: !bug.locked,
      bug: bug.locked ? undefined : bug, // unlocked bugs are no longer secret
      passScore: quiz.passScore,
      questions: quiz.questions.map(toPublic), // no answerIndex, hints or explanations
    });
  } catch {
    return NextResponse.json({ error: "Could not build the quiz. Try again." }, { status: 502 });
  }
}
