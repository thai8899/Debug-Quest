// Stub for Harshitha's lib/tiger.ts recordXpEvent. Swap this body for the real call once it is pushed.
export async function recordXpEvent(e: { userId: string; event: "quiz_pass" | "quiz_fail" | "hint_used" | "bug_unlocked"; bugCategory?: string; xp: number; secondsToSolve?: number }) {
  console.log("[xp]", JSON.stringify(e));
}
