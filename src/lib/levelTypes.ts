// "Trap the bug" level format. Shared by the server (grading) and the browser (display only).
export type GuardId = "shift" | "edge" | "null" | "await" | "type" | "check" | "log" | "retry";
export type GuardDef = { id: GuardId; name: string; cost: number; desc: string };

// Plain-English tool descriptions, shown to the player. Decoys are real tools that just don't fit every bug.
export const GUARD_CATALOG: Record<GuardId, GuardDef> = {
  shift: { id: "shift", name: "Count from zero", cost: 20, desc: "Fixes code that counts from 1 when the computer counts from 0, like page numbers and positions." },
  edge: { id: "edge", name: "Stop at the edge", cost: 20, desc: "Makes a loop or range stop one step early so it never reads past the last item." },
  null: { id: "null", name: "Null check", cost: 20, desc: "Skips safely when a value might be missing instead of crashing on it." },
  await: { id: "await", name: "Wait for it", cost: 30, desc: "Pauses until a slow job, like saving to a database, has really finished." },
  type: { id: "type", name: "Check the type", cost: 20, desc: "Makes sure a value is the right kind of thing (a number, not text) before using it." },
  check: { id: "check", name: "Validate input", cost: 20, desc: "Rejects bad or unexpected input at the door, before the code uses it." },
  log: { id: "log", name: "Add a log", cost: 10, desc: "Writes a message so you can see what happened. It does not change the behavior." },
  retry: { id: "retry", name: "Try again", cost: 20, desc: "Runs the step a second time if it fails. Useful for flaky networks, not for wrong logic." },
};

export type Hazard = { guard: GuardId; crash: string; why: string; hint: string };
export type Station = { id: string; line: number; code: string; hazard?: Hazard };
export type Level = { bugId: string; symptom: string; budget: number; guards: GuardId[]; stations: Station[] };

// What the browser gets: no hazards, no answers.
export type PublicLevel = { symptom: string; budget: number; guards: GuardDef[]; stations: Pick<Station, "id" | "line" | "code">[] };
export const toPublicLevel = (l: Level): PublicLevel => ({
  symptom: l.symptom, budget: l.budget, guards: l.guards.map((g) => GUARD_CATALOG[g]),
  stations: l.stations.map(({ id, line, code }) => ({ id, line, code })),
});

export type TraceStep = { stationId: string; result: "clear" | "caught" | "crash" };
export type RunResult =
  | { passed: true; trace: TraceStep[]; stars: number; xpEarned: number; spent: number; review: { line: number; why: string }[] }
  | { passed: false; trace: TraceStep[]; crashedAt: string; crash: string; hint?: string; fails: number };

// ---- Bug Chomp (arcade mode) ----
// Ghosts pop out of holes carrying one line of code. The player chomps the buggy ones.
export type PublicSpawn = { id: number; hole: number; at: number; show: number; stationId: string; line: number; code: string };
export type ArcadeStart = { token: string; durationMs: number; leadMs: number; lives: number; goal: number; spawns: PublicSpawn[] };
export type ArcadeResult =
  | { passed: true; stars: number; xpEarned: number; caught: number; total: number; wrong: number; review: { line: number; why: string }[] }
  | { passed: false; caught: number; total: number; wrong: number; outOfLives: boolean; crash: string; hint?: string; fails: number };
