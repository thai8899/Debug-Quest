import { createHmac } from "crypto";
import type { Level, ArcadeResult, PublicSpawn } from "./levelTypes";

// Bug Chomp. The server owns the schedule and the answers: the browser only sees code lines and sends taps.
export const DURATION = 30_000;
export const LEAD = 3_500; // countdown before the first ghost
export const LIVES = 3;
export const HOLES = 9;
const SECRET = process.env.GAME_SECRET || "dq-local-dev-secret";

export type Mode = "chomp" | "rain" | "hunt" | "pop";
export const MODE_IDS: Mode[] = ["chomp", "rain", "hunt", "pop"];
export const isMode = (m: unknown): m is Mode => MODE_IDS.includes(m as Mode);
// hole: chomp = hole 0-8, rain = lane 0-2, hunt = unused, pop = tile 0-11
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

// Keep the number of bug spawns inside [lo, hi] so every seed is a fair round.
function flags(r: () => number, n: number, p: number, lo: number, hi: number) {
  const f = Array.from({ length: n }, () => r() < p);
  const count = () => f.filter(Boolean).length;
  while (count() < lo) f[Math.floor(r() * n)] = true;
  while (count() > hi) f[Math.floor(r() * n)] = false;
  return f;
}

export function schedule(level: Level, seed: number, mode: Mode = "chomp"): Spawn[] {
  const r = rng(seed);
  const bugs = level.stations.filter((s) => s.hazard);
  const fine = level.stations.filter((s) => !s.hazard);
  const pick = (bug: boolean) => {
    const pool = bug ? bugs : fine;
    return (pool[Math.floor(r() * pool.length)] ?? level.stations[0]).id;
  };
  const out: Spawn[] = [];

  if (mode === "pop") {
    // 4 rounds, each a 12-tile board with 3-5 buggy tiles
    for (let round = 0; round < 4; round++) {
      const f = flags(r, 12, 0.34, 3, 5);
      f.forEach((bug, tile) => out.push({ id: out.length, hole: tile, at: 300 + round * 7000, show: 6500, stationId: pick(bug), bug }));
    }
    return out;
  }

  const cfg = mode === "rain" ? { n: 22, gap: 1200, lanes: 3, p: 0.42, lo: 7, hi: 11 }
    : mode === "hunt" ? { n: 16, gap: 1600, lanes: 1, p: 0.45, lo: 6, hi: 9 }
    : { n: 20, gap: 1400, lanes: HOLES, p: 0.42, lo: 7, hi: 10 };
  flags(r, cfg.n, cfg.p, cfg.lo, cfg.hi).forEach((bug, i) => {
    const at = Math.round((mode === "hunt" ? 500 : 600) + i * cfg.gap + r() * 250);
    const show = mode === "rain" ? Math.max(2600, Math.round(3800 - i * 30 + r() * 150))
      : mode === "hunt" ? Math.max(3600, Math.round(5200 - i * 60 + r() * 200))
      : Math.max(2800, Math.round(3900 - i * 40 + r() * 200));
    const cut = Math.max(1500, Math.min(show, DURATION - at - 200));
    let hole = 0;
    if (mode === "chomp") {
      const busy = new Set(out.filter((o) => o.at + o.show + 300 > at).map((o) => o.hole));
      const free = Array.from({ length: HOLES }, (_, h) => h).filter((h) => !busy.has(h) && h !== out[i - 1]?.hole);
      hole = free[Math.floor(r() * free.length)] ?? Math.floor(r() * HOLES);
    } else if (mode === "rain") hole = Math.floor(r() * cfg.lanes);
    out.push({ id: i, hole, at, show: cut, stationId: pick(bug), bug });
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
export const makeToken = (bugId: string, seed: number, startMs: number, mode: Mode = "chomp") => {
  const p = `${bugId}|${seed}|${startMs}|${mode}`;
  return `${Buffer.from(p).toString("base64url")}.${sign(p)}`;
};
export function readToken(token: unknown, bugId: string): { seed: number; startMs: number; mode: Mode } | null {
  if (typeof token !== "string") return null;
  const [b, s] = token.split(".");
  if (!b || !s) return null;
  const p = Buffer.from(b, "base64url").toString();
  if (sign(p) !== s) return null;
  const [id, seed, startMs, mode] = p.split("|");
  return id === bugId && isMode(mode) ? { seed: Number(seed), startMs: Number(startMs), mode } : null;
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
