import { createHmac } from "crypto";
import type { Level, ArcadeResult, PublicSpawn } from "./levelTypes";

// Bug Chomp. The server owns the schedule and the answers: the browser only sees code lines and sends taps.
export const DURATION = 30_000;
export const LEAD = 3_500; // countdown before the first ghost
export const LIVES = 3;
export const HOLES = 9;
const SECRET = process.env.GAME_SECRET || "dq-local-dev-secret";

export type Spawn = { id: number; hole: number; at: number; show: number; stationId: string; bug: boolean };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function schedule(level: Level, seed: number): Spawn[] {
  const r = rng(seed);
  const bugs = level.stations.filter((s) => s.hazard);
  const fine = level.stations.filter((s) => !s.hazard);
  const n = 24;
  const flags = Array.from({ length: n }, () => r() < 0.42);
  const count = () => flags.filter(Boolean).length;
  while (count() < 8) flags[Math.floor(r() * n)] = true;
  while (count() > 12) flags[Math.floor(r() * n)] = false;

  const out: Spawn[] = [];
  flags.forEach((bug, i) => {
    const at = Math.round(600 + i * 1150 + r() * 250);
    const show = Math.max(1400, Math.round(2400 - i * 35 + r() * 200));
    const busy = new Set(out.filter((o) => o.at + o.show + 300 > at).map((o) => o.hole));
    const free = Array.from({ length: HOLES }, (_, h) => h).filter((h) => !busy.has(h) && h !== out[i - 1]?.hole);
    const hole = free[Math.floor(r() * free.length)] ?? Math.floor(r() * HOLES);
    const pool = bug ? bugs : fine;
    const st = pool[Math.floor(r() * pool.length)] ?? level.stations[0];
    out.push({ id: i, hole, at, show, stationId: st.id, bug });
  });
  return out;
}

export function publicSpawns(level: Level, spawns: Spawn[]): PublicSpawn[] {
  return spawns.map(({ id, hole, at, show, stationId }) => {
    const st = level.stations.find((s) => s.id === stationId)!;
    return { id, hole, at, show, stationId, line: st.line, code: st.code };
  });
}

const sign = (p: string) => createHmac("sha256", SECRET).update(p).digest("hex").slice(0, 24);
export const makeToken = (bugId: string, seed: number, startMs: number) => {
  const p = `${bugId}|${seed}|${startMs}`;
  return `${Buffer.from(p).toString("base64url")}.${sign(p)}`;
};
export function readToken(token: unknown, bugId: string): { seed: number; startMs: number } | null {
  if (typeof token !== "string") return null;
  const [b, s] = token.split(".");
  if (!b || !s) return null;
  const p = Buffer.from(b, "base64url").toString();
  if (sign(p) !== s) return null;
  const [id, seed, startMs] = p.split("|");
  return id === bugId ? { seed: Number(seed), startMs: Number(startMs) } : null;
}

const SLACK = 900;
// A tap only counts while that ghost is really out of its hole.
export const inWindow = (sp: Spawn, startMs: number, now = Date.now()) => {
  const t = now - startMs;
  return t >= sp.at - SLACK && t <= sp.at + sp.show + SLACK;
};

const g = globalThis as unknown as { __dqArcadeFails?: Map<string, number> };
const fails = (g.__dqArcadeFails ??= new Map<string, number>());

export function grade(level: Level, spawns: Spawn[], whacked: unknown, startMs: number, now = Date.now()): { error: string } | { result: ArcadeResult } {
  const ids = Array.isArray(whacked) ? [...new Set(whacked.filter((x): x is number => Number.isInteger(x)))] : [];
  const byId = new Map(spawns.map((s) => [s.id, s]));
  const hits = ids.map((i) => byId.get(i)).filter((s): s is Spawn => !!s);
  const caught = hits.filter((s) => s.bug).length;
  const wrong = hits.length - caught;
  const total = spawns.filter((s) => s.bug).length;
  const outOfLives = wrong >= LIVES;
  if (!outOfLives && now - startMs < DURATION - 1500) return { error: "round is not over yet" };

  const goal = Math.ceil(total * 0.7);
  const hazard = (level.stations.find((s) => s.hazard) ?? level.stations[0]).hazard;
  if (outOfLives || caught < goal) {
    const n = (fails.get(level.bugId) ?? 0) + 1;
    fails.set(level.bugId, n);
    return { result: { passed: false, caught, total, wrong, outOfLives, crash: hazard?.crash ?? "The bug slipped through.", hint: n >= 2 ? hazard?.hint : undefined, fails: n } };
  }
  fails.delete(level.bugId);
  const stars = Math.max(1, 3 - (caught < total ? 1 : 0) - (wrong > 0 ? 1 : 0));
  return { result: { passed: true, stars, xpEarned: 30 + 20 * stars, caught, total, wrong,
    review: level.stations.filter((s) => s.hazard).map((s) => ({ line: s.line, why: s.hazard!.why })) } };
}
