import { NextResponse } from "next/server";
import { getBug, getQuiz, unlockBug } from "@/lib/data";
import { grade } from "@/lib/quiz";
import { recordXpEvent } from "@/lib/xp";

const PASS_XP = 50;

export async function POST(req: Request, { params }: { params: Promise<{ bugId: string }> }) {
  const bug = await getBug((await params).bugId);
  const quiz = bug && (await getQuiz(bug.id));
  if (!bug || !quiz) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { answers, secondsToSolve } = await req.json().catch(() => ({}));
  const { correct, passed, flags } = grade(quiz, answers);

  if (!passed) {
    await recordXpEvent({ userId: "demo", event: "quiz_fail", bugCategory: bug.category, xp: 0, secondsToSolve });
    const firstMiss = flags.findIndex((f) => !f);
    // On a fail, reveal only the score and one hint, never which answers were right.
    return NextResponse.json({ passed: false, xpEarned: 0, correct, total: quiz.questions.length, hint: quiz.questions[firstMiss]?.hint ?? "" });
  }

  const firstTime = bug.locked;
  if (firstTime) {
    await unlockBug(bug.id);
    await recordXpEvent({ userId: "demo", event: "quiz_pass", bugCategory: bug.category, xp: PASS_XP, secondsToSolve });
    await recordXpEvent({ userId: "demo", event: "bug_unlocked", bugCategory: bug.category, xp: 0 });
  }
  return NextResponse.json({
    passed: true, xpEarned: firstTime ? PASS_XP : 0, correct, total: quiz.questions.length,
    bug: await getBug(bug.id),
    review: quiz.questions.map((q, i) => ({ prompt: q.prompt, correct: flags[i], whyCorrect: q.whyCorrect })),
  });
}
