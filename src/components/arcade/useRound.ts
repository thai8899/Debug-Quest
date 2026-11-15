"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Bug } from "@/lib/contract";
import type { ArcadeMode, ArcadeResult, ArcadeStart, PublicSpawn } from "@/lib/levelTypes";

export type Phase = "intro" | "loading" | "playing" | "submitting" | "failed" | "won";
export type Win = Extract<ArcadeResult, { passed: true }> & { bug: Bug };
export type Fail = Extract<ArcadeResult, { passed: false }>;
export type Pos = { x: number; y: number };
export type Floater = { key: string; hole: number; pos?: Pos; text: string; tone: "good" | "bad" };
export type Chomp = { id: number; hole: number; pos?: Pos; ok: boolean | null };
export type RoundApi = ReturnType<typeof useRound>;

let ctx: AudioContext | null = null;
export function beep(freq: number, ms: number, type: OscillatorType = "square", gain = 0.05, on = true) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch { /* sound is optional */ }
}

// One round of any arcade mode: the server owns the schedule and the answers, this hook runs the clock and sends taps.
export function useRound(bugId: string) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<ArcadeMode>("chomp");
  const [round, setRound] = useState<ArcadeStart | null>(null);
  const [elapsed, setElapsed] = useState(-3500);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [done, setDone] = useState<Record<number, "pending" | "good" | "bad">>({});
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [chomps, setChomps] = useState<Chomp[]>([]);
  const [shake, setShake] = useState(0);
  const [fail, setFail] = useState<Fail | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(true);
  const t0 = useRef(0), whacks = useRef<number[]>([]), ending = useRef(false), startedAt = useRef(0), alive = useRef(true);
  const s = useRef({ lives: 3, combo: 0 });

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function start(m: ArcadeMode = mode) {
    setMode(m); setPhase("loading"); setFail(null); setWin(null); setError("");
    ending.current = false; whacks.current = []; s.current = { lives: 3, combo: 0 };
    setScore(0); setCombo(0); setLives(3); setDone({}); setFloaters([]); setChomps([]);
    beep(520, 90, "square", 0.05, sound);
    try {
      const r = await fetch(`/api/game/${bugId}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) });
      if (!r.ok) throw new Error();
      const j: ArcadeStart = await r.json();
      setRound(j); setLives(j.lives); s.current.lives = j.lives;
      t0.current = performance.now() + j.leadMs; startedAt.current = Date.now();
      setElapsed(-j.leadMs); setPhase("playing");
    } catch { setPhase("intro"); setError("Could not start a round. Try again."); }
  }

  const finish = useCallback(async () => {
    if (ending.current || !round) return;
    ending.current = true; setPhase("submitting");
    // The server refuses to score before the round is really over, so retry briefly if we are a hair early.
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(`/api/game/${bugId}/finish`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: round.token, whacks: whacks.current, secondsToSolve: Math.round((Date.now() - startedAt.current) / 1000) }),
        });
        if (r.status === 400) { await new Promise((x) => setTimeout(x, 600)); continue; }
        if (!r.ok) throw new Error();
        const res: ArcadeResult & { bug?: Bug } = await r.json();
        if (!alive.current) return;
        if (res.passed) { beep(660, 120, "triangle", 0.06, sound); setTimeout(() => beep(880, 200, "triangle", 0.06, sound), 130); setWin(res as Win); setPhase("won"); }
        else { setFail(res); setPhase("failed"); }
        return;
      } catch { break; }
    }
    setError("Could not score the round. Try again."); setPhase("intro");
  }, [bugId, round, sound]);

  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const id = setInterval(() => {
      const e = performance.now() - t0.current;
      setElapsed(e);
      if (e >= round.durationMs) finish();
    }, 50);
    return () => clearInterval(id);
  }, [phase, round, finish]);

  const hit = useCallback(async (sp: PublicSpawn, pos?: Pos) => {
    if (phase !== "playing" || !round || done[sp.id]) return;
    setDone((d) => ({ ...d, [sp.id]: "pending" })); whacks.current.push(sp.id);
    beep(300, 70, "square", 0.05, sound);
    const key = `${sp.id}`;
    setChomps((c) => [...c, { id: sp.id, hole: sp.hole, pos, ok: null }]);
    setTimeout(() => setChomps((c) => c.filter((x) => x.id !== sp.id)), 700);
    const float = (text: string, tone: Floater["tone"]) => {
      setFloaters((f) => [...f, { key, hole: sp.hole, pos, text, tone }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.key !== key)), 900);
    };
    try {
      const r = await fetch(`/api/game/${bugId}/whack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: round.token, spawn: sp.id }) });
      if (!r.ok) throw new Error();
      const { bug } = await r.json();
      setDone((d) => ({ ...d, [sp.id]: bug ? "good" : "bad" }));
      setChomps((c) => c.map((x) => (x.id === sp.id ? { ...x, ok: !!bug } : x)));
      if (bug) {
        s.current.combo += 1; const c = s.current.combo;
        setScore((x) => x + 100 * Math.min(c, 5)); setCombo(c);
        float(c > 1 ? `+${100 * Math.min(c, 5)}  x${c}` : "+100", "good"); beep(700 + c * 60, 110, "triangle", 0.06, sound);
      } else {
        s.current.combo = 0; s.current.lives -= 1; setCombo(0); setLives(s.current.lives); setShake((n) => n + 1);
        float("That line is fine!", "bad"); beep(120, 220, "sawtooth", 0.07, sound);
        if (s.current.lives <= 0) finish();
      }
    } catch {
      setDone((d) => { const n = { ...d }; delete n[sp.id]; return n; });
      whacks.current = whacks.current.filter((i) => i !== sp.id);
    }
  }, [phase, round, done, bugId, sound, finish]);

  return { phase, setPhase, mode, setMode, round, elapsed, score, combo, lives, done, floaters, chomps, shake, fail, win, error, setError, sound, setSound, start, hit };
}
