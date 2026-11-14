// Records XP events to Harshitha's Tiger Data helper (lib/tiger.ts) when TIGER_DATABASE_URL is set.
// Never blocks or fails grading: errors are logged and swallowed, and without the env var it only logs.
export async function recordXpEvent(e: { userId: string; event: "quiz_pass" | "quiz_fail" | "hint_used" | "bug_unlocked"; bugCategory?: string; xp: number; secondsToSolve?: number }) {
  if (!process.env.TIGER_DATABASE_URL) {
    console.log("[xp]", JSON.stringify(e));
    return;
  }
  try {
    const { recordXpEvent: save } = await import("./tiger");
    await save({ userId: e.userId, event: e.event, bugCategory: e.bugCategory ?? "unknown", xp: e.xp, secondsToSolve: e.secondsToSolve ?? 0 });
  } catch (err) {
    console.warn("[xp] tiger write failed, continuing:", err instanceof Error ? err.message : err);
  }
}
