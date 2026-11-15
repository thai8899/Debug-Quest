import { GoogleGenAI, Type } from "@google/genai";
import type { Bug } from "./contract";
import { getLevel, saveLevel } from "./data";
import { GUARD_CATALOG, type GuardId, type Level, type RunResult, type Station, type TraceStep } from "./levelTypes";

const IDS = Object.keys(GUARD_CATALOG) as GuardId[];
const GUARD_LINES = IDS.map((g) => `- ${g}: ${GUARD_CATALOG[g].name}. ${GUARD_CATALOG[g].desc}`).join("\n");

// Hand-written levels for the demo bugs, so the demo never depends on Gemini.
const st = (line: number, code: string, hazard?: Station["hazard"]): Omit<Station, "id"> => ({ line, code, hazard });
const CANNED: Record<string, { symptom: string; guards: GuardId[]; stations: Omit<Station, "id">[] }> = {
  "demo-1": {
    symptom: "Page 1 of the todo list shows todos 11 to 20 instead of 1 to 10.",
    guards: ["shift", "edge", "check", "log"],
    stations: [
      st(12, "export function getPage(todos, page, pageSize) {"),
      st(14, "if (pageSize <= 0) return [];"),
      st(15, "const start = page * pageSize;", { guard: "shift", crash: "Page 1 starts at todo 11, so the first 10 todos are skipped.", why: "Pages are numbered from 1 but lists start at 0. Subtract 1 from the page number before multiplying.", hint: "Think about which position the very first page should start at." }),
      st(16, "const end = start + pageSize;"),
      st(17, "return todos.slice(start, end);"),
    ],
  },
  "demo-2": {
    symptom: "Summarizing a todo that has no description crashes the whole app.",
    guards: ["null", "type", "retry", "log"],
    stations: [
      st(4, "const id = todo.id;"),
      st(5, "const title = todo.title;"),
      st(6, "const notes = todo.description.trim();", { guard: "null", crash: "TypeError: cannot read 'trim' of undefined. The description was missing.", why: "The description is optional, so it can be missing. Calling .trim() on a missing value crashes; ?. skips the call safely.", hint: "What happens to a value you call a method on when it was never set?" }),
      st(7, 'const done = todo.done ? "done" : "open";'),
      st(8, "return `${id}: ${title} (${done}) ${notes}`;"),
    ],
  },
  "demo-3": {
    symptom: "A todo you just added sometimes is missing when you load the list right after.",
    guards: ["await", "retry", "null", "log"],
    stations: [
      st(21, "export async function addTodo(db, title) {"),
      st(22, "const todo = { id: nextId(), title, done: false };"),
      st(23, "db.save(todo);", { guard: "await", crash: "The function returned before the save finished, so the next read missed the todo.", why: "Saving takes time and returns a promise. Without await the function moves on before the database has the todo.", hint: "Saving to a database is slow. Does this line wait for it to finish?" }),
      st(24, "return todo;"),
    ],
  },
};

const norm = (c: { symptom: string; guards: GuardId[]; stations: Omit<Station, "id">[] }, bugId: string): Level => {
  const stations = c.stations.map((s, i) => ({ ...s, id: `s${i + 1}` }));
  const need = stations.filter((s) => s.hazard).reduce((n, s) => n + GUARD_CATALOG[s.hazard!.guard].cost, 0);
  return { bugId, symptom: c.symptom, guards: c.guards, stations, budget: need + 20 };
};

function valid(x: unknown): x is { symptom: string; guards: GuardId[]; stations: Omit<Station, "id">[] } {
  const v = x as { symptom?: unknown; guards?: unknown; stations?: unknown };
  if (!v || typeof v.symptom !== "string" || !Array.isArray(v.guards) || !Array.isArray(v.stations)) return false;
  const guards = v.guards as string[];
  if (guards.length < 4 || guards.length > 6 || new Set(guards).size !== guards.length || !guards.every((g) => IDS.includes(g as GuardId))) return false;
  const stations = v.stations as Station[];
  if (stations.length < 3 || stations.length > 6) return false;
  const hz = stations.filter((s) => s.hazard);
  if (hz.length < 1 || hz.length > 2) return false;
  return stations.every((s) => Number.isInteger(s.line) && typeof s.code === "string" && s.code.trim() && s.code.length <= 90 &&
    (!s.hazard || (guards.includes(s.hazard.guard) && [s.hazard.crash, s.hazard.why, s.hazard.hint].every((t) => typeof t === "string" && t))));
}

// Last resort: find the line the fix changed and build a level around it.
function heuristic(bug: Bug): Level {
  const a = bug.originalCode.split("\n"), b = bug.fixedCode.split("\n");
  let hz = a.findIndex((l, i) => l !== b[i]);
  if (hz < 0) hz = Math.floor(a.length / 2);
  const real = a.map((l, i) => ({ l: l.trim(), i })).filter((x) => x.l && !/^[{}]+$/.test(x.l) && !x.l.startsWith("//"));
  const at = Math.max(0, real.findIndex((x) => x.i === hz));
  const from = Math.max(0, Math.min(at - 2, real.length - 5));
  const pick = real.slice(from, from + 5);
  const cat = bug.category.toLowerCase();
  const guard: GuardId = /async|await|promise|race/.test(cat) ? "await" : /null|undefined|missing/.test(cat) ? "null"
    : /off|index|bound|range/.test(cat) ? (a[hz]?.includes("<=") ? "edge" : "shift") : /type/.test(cat) ? "type" : "check";
  const others = IDS.filter((g) => g !== guard).sort((x, y) => (x === "log" ? -1 : y === "log" ? 1 : 0));
  const stations = pick.map((x) => st(bug.lineStart + x.i, x.l.slice(0, 90), x.i === hz
    ? { guard, crash: "The bug strikes on this line.", why: bug.explainSimple, hint: `Look at the file ${bug.file}: what kind of mistake is "${bug.category}"?` } : undefined));
  return norm({ symptom: `Something in ${bug.file} is going wrong (${bug.category}).`, guards: [guard, ...others.slice(0, 3)], stations }, bug.id);
}

async function makeLevel(bug: Bug): Promise<Level> {
  if (CANNED[bug.id]) return norm(CANNED[bug.id], bug.id);
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("no key");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
    const str = { type: Type.STRING };
    const res = await Promise.race([
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
        contents: `You design a tiny puzzle level from a real bug. A "bug-bot" walks through the lines of code in order. The player must place the right guard tool on the line where the code breaks.

Guard tools (use these ids only):
${GUARD_LINES}

Rules:
- "stations": 4 to 6 lines copied exactly from the ORIGINAL code, in order, skipping blank lines, comments and lone braces. Include the buggy line(s).
- Exactly 1 station (at most 2) has a "hazard": the line that is actually buggy. Its "guard" is the tool that matches the real fix.
- "guards": 4 or 5 tool ids including every hazard guard, the rest plausible decoys (include "log" as a decoy).
- "symptom": one sentence describing what a USER sees go wrong. Do not name the cause or the fix.
- hazard.crash: what goes wrong at runtime, one sentence, concrete. hazard.why: plain-English reason the guard fixes it (reading level: beginner). hazard.hint: a nudge that does not name the guard.
- "line" is the real line number: the file's first line of this snippet is ${bug.lineStart}.

Bug: ${JSON.stringify({ file: bug.file, category: bug.category, lineStart: bug.lineStart, originalCode: bug.originalCode, fixedCode: bug.fixedCode, explainSimple: bug.explainSimple })}

Return JSON: { "symptom", "guards": [ids], "stations": [ { "line", "code", "hazard": null or { "guard", "crash", "why", "hint" } } ] }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              symptom: str, guards: { type: Type.ARRAY, items: str },
              stations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                line: { type: Type.INTEGER }, code: str,
                hazard: { type: Type.OBJECT, nullable: true, properties: { guard: str, crash: str, why: str, hint: str }, required: ["guard", "crash", "why", "hint"] } },
                required: ["line", "code"] } },
            },
            required: ["symptom", "guards", "stations"],
          },
        },
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 25_000)),
    ]);
    const parsed = JSON.parse(res.text ?? "{}");
    for (const s of parsed.stations ?? []) if (!s.hazard) delete s.hazard;
    if (!valid(parsed)) throw new Error("bad level shape");
    // Every board line must really come from the bug's code; Gemini sometimes invents extra "context".
    const real = new Set(bug.originalCode.split("\n").map((l) => l.trim()).filter(Boolean));
    if (!parsed.stations.every((st: { code: string }) => real.has(st.code.trim()))) throw new Error("level used code that is not in the bug");
    return norm(parsed, bug.id);
  } catch (e) {
    console.warn("[game] Gemini level failed, using heuristic:", e instanceof Error ? e.message.slice(0, 200) : e);
    return heuristic(bug);
  }
}

export async function getOrMakeLevel(bug: Bug): Promise<Level> {
  const existing = await getLevel(bug.id);
  if (existing) return existing;
  const level = await makeLevel(bug);
  await saveLevel(level);
  return level;
}

// Call from the scan pipeline right after bugs are saved so levels are ready when the user opens them.
export async function prepareLevels(bugs: Bug[]) {
  await Promise.allSettled(bugs.map((b) => getOrMakeLevel(b)));
}

const g = globalThis as unknown as { __dqFails?: Map<string, number> };
const fails = (g.__dqFails ??= new Map<string, number>());

// The whole game is decided here, on the server: the browser only ever sends where it put guards.
export function runLevel(level: Level, placements: unknown): { error: string } | { result: RunResult; spent: number; extras: number } {
  const p = (placements && typeof placements === "object" ? placements : {}) as Record<string, string>;
  const ids = new Set(level.stations.map((s) => s.id));
  let spent = 0;
  for (const [sid, gid] of Object.entries(p)) {
    if (!ids.has(sid) || !IDS.includes(gid as GuardId) || !level.guards.includes(gid as GuardId)) return { error: "invalid placement" };
    spent += GUARD_CATALOG[gid as GuardId].cost;
  }
  if (spent > level.budget) return { error: "over budget" };

  const trace: TraceStep[] = [];
  let extras = Object.keys(p).length;
  for (const s of level.stations) {
    if (!s.hazard) { trace.push({ stationId: s.id, result: "clear" }); continue; }
    if (p[s.id] === s.hazard.guard) { extras--; trace.push({ stationId: s.id, result: "caught" }); continue; }
    trace.push({ stationId: s.id, result: "crash" });
    const n = (fails.get(level.bugId) ?? 0) + 1;
    fails.set(level.bugId, n);
    return { spent, extras, result: { passed: false, trace, crashedAt: s.id, crash: s.hazard.crash, hint: n >= 2 ? s.hazard.hint : undefined, fails: n } };
  }
  const failed = fails.get(level.bugId) ?? 0;
  fails.delete(level.bugId);
  const stars = Math.max(1, 3 - (failed > 0 ? 1 : 0) - (extras > 0 ? 1 : 0));
  return {
    spent, extras,
    result: { passed: true, trace, stars, xpEarned: 30 + 20 * stars, spent,
      review: level.stations.filter((s) => s.hazard).map((s) => ({ line: s.line, why: s.hazard!.why })) },
  };
}
