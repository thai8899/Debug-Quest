"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Flame, Heart, Lightbulb, RotateCcw, Star, Volume2, VolumeX } from "lucide-react";
import type { Bug } from "@/lib/contract";
import type { ArcadeResult, ArcadeStart, PublicSpawn } from "@/lib/levelTypes";
import UnlockReveal from "@/components/UnlockReveal";
import Chomper from "@/components/Chomper";
import Logo from "@/components/Logo";

type Meta = { bugId: string; scanId: string; file: string; symptom: string; unlocked: boolean; bug?: Bug };
type Win = Extract<ArcadeResult, { passed: true }> & { bug: Bug };
type Fail = Extract<ArcadeResult, { passed: false }>;
type Floater = { key: string; hole: number; text: string; tone: "good" | "bad" };
const COLORS = ["#ff7eb6", "#4fe3d4", "#ffb347", "#a78bfa", "#8ee36a", "#6ea8ff"];
const btn = "btn3d inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-display text-base font-bold text-[#2a1a00] disabled:opacity-40";

let ctx: AudioContext | null = null;
function beep(freq: number, ms: number, type: OscillatorType = "square", gain = 0.05, on = true) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch { /* sound is optional */ }
}

export default function PlayPage() {
  const { bugId } = useParams<{ bugId: string }>();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"intro" | "loading" | "playing" | "submitting" | "failed" | "won">("intro");
  const [round, setRound] = useState<ArcadeStart | null>(null);
  const [elapsed, setElapsed] = useState(-3500);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [done, setDone] = useState<Record<number, "pending" | "good" | "bad">>({});
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [shake, setShake] = useState(0);
  const [chomps, setChomps] = useState<{ id: number; hole: number }[]>([]);
  const [fail, setFail] = useState<Fail | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  const [sound, setSound] = useState(true);
  const t0 = useRef(0);
  const whacks = useRef<number[]>([]);
  const ending = useRef(false);
  const startedAt = useRef(0);
  const alive = useRef(true);
  const s = useRef({ lives: 3, combo: 0 });

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    fetch(`/api/game/${bugId}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "Could not load the level.");
      setMeta(j);
    }).catch(() => setError("Could not load the level."));
  }, [bugId]);

  async function start() {
    setPhase("loading"); setFail(null); setWin(null);
    ending.current = false; whacks.current = []; s.current = { lives: 3, combo: 0 };
    setScore(0); setCombo(0); setLives(3); setDone({}); setFloaters([]);
    beep(520, 90, "square", 0.05, sound);
    try {
      const r = await fetch(`/api/game/${bugId}/start`, { method: "POST" });
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

  // game clock
  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const id = setInterval(() => {
      const e = performance.now() - t0.current;
      setElapsed(e);
      if (e >= round.durationMs) finish();
    }, 50);
    return () => clearInterval(id);
  }, [phase, round, finish]);

  function float(hole: number, text: string, tone: Floater["tone"]) {
    const key = `${hole}-${performance.now()}`;
    setFloaters((f) => [...f, { key, hole, text, tone }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.key !== key)), 900);
  }

  async function chomp(sp: PublicSpawn) {
    if (phase !== "playing" || !round || done[sp.id]) return;
    setDone((d) => ({ ...d, [sp.id]: "pending" })); whacks.current.push(sp.id);
    beep(300, 70, "square", 0.05, sound);
    setChomps((c) => [...c, { id: sp.id, hole: sp.hole }]);
    setTimeout(() => setChomps((c) => c.filter((x) => x.id !== sp.id)), 650);
    try {
      const r = await fetch(`/api/game/${bugId}/whack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: round.token, spawn: sp.id }) });
      if (!r.ok) throw new Error();
      const { bug } = await r.json();
      setDone((d) => ({ ...d, [sp.id]: bug ? "good" : "bad" }));
      if (bug) {
        s.current.combo += 1; const c = s.current.combo;
        setScore((x) => x + 100 * Math.min(c, 5)); setCombo(c);
        float(sp.hole, c > 1 ? `+${100 * Math.min(c, 5)}  x${c}` : "+100", "good"); beep(700 + c * 60, 110, "triangle", 0.06, sound);
      } else {
        s.current.combo = 0; s.current.lives -= 1; setCombo(0); setLives(s.current.lives); setShake((n) => n + 1);
        float(sp.hole, "That line is fine!", "bad"); beep(120, 220, "sawtooth", 0.07, sound);
        if (s.current.lives <= 0) finish();
      }
    } catch { setDone((d) => { const n = { ...d }; delete n[sp.id]; return n; }); whacks.current = whacks.current.filter((i) => i !== sp.id); }
  }

  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const onKey = (e: KeyboardEvent) => {
      const h = Number(e.key) - 1;
      if (!(h >= 0 && h < 9)) return;
      const sp = round.spawns.find((x) => x.hole === h && elapsed >= x.at && elapsed < x.at + x.show && !done[x.id]);
      if (sp) chomp(sp);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  if (error && !meta) return <Shell><div role="alert" className="rounded-md border border-sev-high/50 bg-sev-high/10 p-4">{error}</div></Shell>;
  if (!meta) return <Shell><div className="text-[#ede8dc]/70">Loading the level.</div></Shell>;

  const back = <Link href={`/scan/${meta.scanId}`} className="inline-flex w-fit items-center gap-2 text-sm text-[#ede8dc]/70 hover:text-accent"><ArrowLeft size={16} /> Back to results</Link>;
  const reveal = win ? { bug: win.bug, xp: win.xpEarned } : meta.unlocked && meta.bug && phase === "intro" ? { bug: meta.bug, xp: 0 } : null;

  if (reveal) return (
    <Shell>
      {back}
      {win && (
        <div className="flex flex-col items-center gap-2 py-2" aria-label={`${win.stars} of 3 stars`}>
          <div className="flex gap-2">{[1, 2, 3].map((n) => <Star key={n} size={32} className={n <= win.stars ? "fill-accent text-accent" : "text-[#ede8dc]/25"} />)}</div>
          <div className="font-mono text-xs text-[#ede8dc]/60">You chomped {win.caught} of {win.total} bugs{win.wrong ? ` and ${win.wrong} good line${win.wrong > 1 ? "s" : ""} by mistake` : " and no good lines"}</div>
        </div>
      )}
      <UnlockReveal bug={reveal.bug} xp={reveal.xp} />
      {win && (
        <div className="rounded-md border border-line bg-panel p-4">
          <h3 className="mb-2 font-display text-lg font-semibold">The buggy line</h3>
          <ul className="flex flex-col gap-2 text-[#ede8dc]/85">{win.review.map((r) => <li key={r.line}><span className="font-mono text-accent">line {r.line}</span> {r.why}</li>)}</ul>
        </div>
      )}
      {meta.unlocked && !win && <button onClick={start} className={`${btn} w-fit`}>Play again</button>}
    </Shell>
  );

  const countdown = elapsed < 0 ? Math.ceil(-elapsed / 1000) : 0;
  const pct = round ? Math.max(0, Math.min(100, (elapsed / round.durationMs) * 100)) : 0;

  return (
    <Shell>
      {back}
      {(phase === "intro" || phase === "loading") && (
        <div className="slab mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-lg border border-line bg-panel p-6 text-center">
          <Chomper size={96} />
          <h1 className="font-display text-3xl font-bold">Bug Chomp</h1>
          <p className="max-w-md text-lg text-[#ede8dc]/90">Something is wrong in <span className="font-mono text-accent">{meta.file}</span>: <span className="font-semibold text-white">{meta.symptom}</span></p>
          <ul className="flex w-full max-w-sm flex-col gap-1.5 text-left text-sm text-[#ede8dc]/85">
            <li>Ghosts pop out of the holes, each carrying one line of code.</li>
            <li>Tap the ones carrying the <span className="text-sev-high">buggy line</span> before they hide.</li>
            <li>Chomp a good line and you lose a heart. Three hearts, 30 seconds.</li>
          </ul>
          {error && <p role="alert" className="text-sm text-sev-high">{error}</p>}
          <button onClick={start} disabled={phase === "loading"} className={btn}>{phase === "loading" ? "Getting ready" : "Play"}</button>
          <div className="text-xs text-[#ede8dc]/50">On a keyboard, press 1 to 9 to chomp a hole.</div>
        </div>
      )}

      {(phase === "playing" || phase === "submitting") && round && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel px-4 py-2">
            <div className="flex gap-1" aria-label={`${lives} hearts left`}>{[0, 1, 2].map((i) => <Heart key={i} size={24} className={i < lives ? "fill-sev-high text-sev-high" : "text-[#ede8dc]/25"} />)}</div>
            <div className="font-display text-2xl font-bold tabular-nums">{score}</div>
            <div className={`flex items-center gap-1 font-display text-lg font-bold ${combo > 1 ? "text-accent" : "text-[#ede8dc]/35"}`}><Flame size={20} /> x{Math.max(combo, 1)}</div>
            <button onClick={() => setSound(!sound)} aria-label={sound ? "Mute" : "Unmute"} className="text-[#ede8dc]/60 hover:text-accent">{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-ok to-accent" style={{ width: `${pct}%` }} /></div>
          <div className="rounded-md border border-sev-high/50 bg-[#2a1250]/70 px-4 py-3 text-center">
            <div className="font-display text-sm font-semibold text-sev-high">Find the line that causes this</div>
            <p className="mt-1 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">{meta.symptom}</p>
          </div>

          <div key={shake} className={`relative grid grid-cols-3 gap-x-3 gap-y-5 rounded-lg border border-line bg-black/20 p-3 pt-6 ${shake ? "shake" : ""}`}>
            {countdown > 0 && (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-[#0a1040]/70">
                <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-8xl font-bold text-accent">{countdown}</motion.div>
              </div>
            )}
            {Array.from({ length: 9 }, (_, h) => {
              const sp = round.spawns.find((x) => x.hole === h && elapsed >= x.at && elapsed < x.at + x.show && !done[x.id]);
              const eaten = chomps.find((x) => x.hole === h);
              const col = COLORS[(sp?.id ?? 0) % COLORS.length];
              return (
                <div key={h} className="relative h-[136px] sm:h-[176px]">
                  <div className="hole-back absolute bottom-1 left-0 right-0 h-10 rounded-[50%]" />
                  <div className="absolute inset-x-0 top-0 bottom-5 overflow-hidden">
                    <AnimatePresence>
                      {sp && (
                        <motion.button key={sp.id} type="button" aria-label={`Hole ${h + 1}: ${sp.code}`} onClick={() => chomp(sp)}
                          initial={{ y: "105%" }} animate={{ y: 0 }} exit={{ y: "105%" }} transition={{ type: "spring", stiffness: 420, damping: 26 }}
                          className="ghost3d absolute inset-x-1 bottom-0 flex h-[116px] cursor-pointer flex-col items-center gap-1 rounded-t-[44px] rounded-b-md px-2 pt-3 text-left sm:h-[150px]"
                          style={{ background: `linear-gradient(180deg, ${col}, ${col}dd)`, ["--g" as string]: col }}>
                          <span className="flex gap-2" aria-hidden>{[0, 1].map((i) => <span key={i} className="flex h-4 w-3.5 items-end justify-center rounded-full bg-white"><span className="mb-0.5 h-2 w-2 rounded-full bg-[#1b1f4d]" /></span>)}</span>
                          <span className="w-full min-w-0 [overflow-wrap:anywhere] rounded-sm bg-[#0e1445]/80 px-1.5 py-1 font-mono text-[11px] font-semibold leading-tight text-[#f4f1e4] sm:text-[14px]" style={{ display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{sp.code}</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="hole-lip absolute bottom-0 left-[-2px] right-[-2px] h-6 rounded-[50%]" aria-hidden />
                  <span className="absolute bottom-0.5 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] text-white/40 sm:block">{h + 1}</span>
                  <AnimatePresence>
                    {eaten && (
                      <motion.div key={`c${eaten.id}`} className="pointer-events-none absolute bottom-3 left-1/2 z-10 -ml-9" initial={{ y: 30, scale: 0.4, opacity: 0 }} animate={{ y: -20, scale: 1, opacity: 1 }} exit={{ y: 30, scale: 0.4, opacity: 0 }}>
                        <Chomper size={72} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {floaters.filter((f) => f.hole === h).map((f) => (
                      <motion.div key={f.key} className={`pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap font-display text-lg font-bold drop-shadow ${f.tone === "good" ? "text-accent" : "text-sev-high"}`} initial={{ y: 10, opacity: 0, scale: 0.7 }} animate={{ y: -34, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}>{f.text}</motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-[#ede8dc]/50">{phase === "submitting" ? "Scoring your round." : `Chomp ${round.goal} or more bugs to unlock the fix.`}</p>
        </div>
      )}

      {phase === "failed" && fail && (
        <div role="alert" className="slab mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-lg border border-sev-high/60 bg-panel p-6 text-center">
          <Chomper size={64} />
          <div className="font-display text-2xl font-bold">{fail.outOfLives ? "Out of hearts" : "Some bugs got away"}</div>
          <p className="text-[#ede8dc]/90">You chomped {fail.caught} of {fail.total} bugs{fail.wrong ? ` and ${fail.wrong} good line${fail.wrong > 1 ? "s" : ""}` : ""}. Here is what the bug does: {fail.crash}</p>
          {fail.hint && <p className="flex gap-2 text-sm text-sev-medium"><Lightbulb size={16} className="mt-0.5 shrink-0" /> {fail.hint}</p>}
          <button onClick={start} className={btn}><RotateCcw size={16} /> Play again</button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6"><Logo />{children}</main>;
}
