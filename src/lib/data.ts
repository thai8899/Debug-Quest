import type { Bug, Quiz, PublicBug, Scan } from "./contract";
import { DEMO_BUGS, demoScan } from "./demo";

// In-memory stand-in for Harshitha's lib/mongo.ts (getBugsForScan, unlockBug, saveQuiz, getQuiz).
// Swap the bodies below for Mongo calls; the signatures stay the same.
type Mem = { bugs: Map<string, Bug>; quizzes: Map<string, Quiz>; started: Map<string, number> };
const g = globalThis as unknown as { __dq?: Mem };
const mem: Mem = (g.__dq ??= {
  bugs: new Map(DEMO_BUGS.map((b) => [b.id, { ...b }])),
  quizzes: new Map(),
  started: new Map(),
});

export async function getBug(id: string) { return mem.bugs.get(id) ?? null; }
export async function getBugsForScan(scanId: string) { return [...mem.bugs.values()].filter((b) => b.scanId === scanId); }
export async function unlockBug(id: string) { const b = mem.bugs.get(id); if (b) b.locked = false; }
export async function getQuiz(bugId: string) { return mem.quizzes.get(bugId) ?? null; }
export async function saveQuiz(quiz: Quiz) { mem.quizzes.set(quiz.bugId, quiz); }
export async function resetDemo() {
  mem.bugs = new Map(DEMO_BUGS.map((b) => [b.id, { ...b }]));
  mem.quizzes.clear();
}

// Locked bugs must never carry the fix or explanations to the browser.
export function redactBug(b: Bug): PublicBug {
  if (!b.locked) return b;
  const { fixedCode: _f, explainSimple: _s, explainDeep: _d, sources: _src, ...rest } = b;
  void _f; void _s; void _d; void _src;
  return rest;
}

// Stub for Punarva's GET /api/scan/[id]; she replaces the route, same shape.
export async function getDemoScan(id: string): Promise<Scan | null> {
  if (id !== "demo" && id !== "demo-running") return null;
  let status: Scan["status"] = "done";
  if (id === "demo-running") {
    const t0 = mem.started.get(id) ?? Date.now();
    mem.started.set(id, t0);
    if (Date.now() - t0 < 8000) status = "running";
  }
  const base = demoScan();
  const bugs = status === "running" ? [] : (await getBugsForScan("demo")).map(redactBug);
  return status === "running" ? { ...base, id, status, bugs, prUrl: undefined, testsBefore: undefined, testsAfter: undefined } : { ...base, id, bugs };
}
