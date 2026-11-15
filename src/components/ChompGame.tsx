"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowLeft, Crosshair, Flame, Grid3x3, Hammer, Heart, Lightbulb, RotateCcw, Star, Volume2, VolumeX } from "lucide-react";
import type { Bug } from "@/lib/contract";
import type { ArcadeMode } from "@/lib/levelTypes";
import UnlockReveal from "@/components/UnlockReveal";
import Chomper from "@/components/Chomper";
import Logo from "@/components/Logo";
import { useRound } from "@/components/arcade/useRound";
import { ChompBoard, HuntBoard, PopBoard, RainBoard } from "@/components/arcade/boards";

type Meta = { bugId: string; scanId: string; file: string; symptom: string; unlocked: boolean; bug?: Bug };
const btn = "btn3d inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-display text-base font-bold text-[#2a1a00] disabled:opacity-40";

const MODES: { id: ArcadeMode; name: string; blurb: string; how: string; Icon: typeof Hammer; color: string }[] = [
  { id: "chomp", name: "Bug Chomp", blurb: "Ghosts pop out of holes. Chomp the ones carrying the buggy line.", how: "Tap a ghost, or press 1 to 9.", Icon: Hammer, color: "#ff7eb6" },
  { id: "rain", name: "Code Rain", blurb: "Lines of code fall from the sky. Catch the buggy ones, dodge the rest.", how: "Tap a lane, or use the arrow keys.", Icon: ArrowDownToLine, color: "#4fe3d4" },
  { id: "hunt", name: "Ghost Hunt", blurb: "Ghosts drift around the arena. Send the lion after the buggy ones.", how: "Tap a ghost and the lion dashes to it.", Icon: Crosshair, color: "#ffb347" },
  { id: "pop", name: "Bug Pop", blurb: "Four candy boards. Pop every tile that holds the buggy line.", how: "Tap the buggy tiles before the board resets.", Icon: Grid3x3, color: "#a78bfa" },
];

export default function ChompGame() {
  const { bugId } = useParams<{ bugId: string }>();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState("");
  const R = useRound(bugId);

  useEffect(() => {
    fetch(`/api/game/${bugId}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setLoadError(j.error ?? "Could not load the level.");
      setMeta(j);
    }).catch(() => setLoadError("Could not load the level."));
  }, [bugId]);

  if (loadError) return <Shell><div role="alert" className="rounded-md border border-sev-high/50 bg-sev-high/10 p-4">{loadError}</div></Shell>;
  if (!meta) return <Shell><div className="text-[#ede8dc]/70">Loading the level.</div></Shell>;

  const { phase, round, win, fail, elapsed } = R;
  const cur = MODES.find((m) => m.id === R.mode)!;
  const back = <Link href={`/scan/${meta.scanId}`} className="inline-flex w-fit items-center gap-2 text-sm text-[#ede8dc]/70 hover:text-accent"><ArrowLeft size={16} /> Back to results</Link>;
  const reveal = win ? { bug: win.bug, xp: win.xpEarned } : meta.unlocked && meta.bug && phase === "intro" && !R.error ? { bug: meta.bug, xp: 0 } : null;

  if (reveal) return (
    <Shell>
      {back}
      {win && (
        <div className="flex flex-col items-center gap-2 py-2" aria-label={`${win.stars} of 3 stars`}>
          <div className="flex gap-2">{[1, 2, 3].map((n) => <Star key={n} size={32} className={n <= win.stars ? "fill-accent text-accent" : "text-[#ede8dc]/25"} />)}</div>
          <div className="font-mono text-xs text-[#ede8dc]/60">You caught {win.caught} of {win.total} bugs{win.wrong ? ` and ${win.wrong} good line${win.wrong > 1 ? "s" : ""} by mistake` : " and no good lines"}</div>
        </div>
      )}
      <UnlockReveal bug={reveal.bug} xp={reveal.xp} />
      {win && (
        <div className="rounded-md border border-line bg-panel p-4">
          <h3 className="mb-2 font-display text-lg font-semibold">The buggy line</h3>
          <ul className="flex flex-col gap-2 text-[#ede8dc]/85">{win.review.map((r) => <li key={r.line}><span className="font-mono text-accent">line {r.line}</span> {r.why}</li>)}</ul>
        </div>
      )}
      {meta.unlocked && !win && <button onClick={() => R.start()} className={`${btn} w-fit`}>Play again</button>}
    </Shell>
  );

  const countdown = elapsed < 0 ? Math.ceil(-elapsed / 1000) : 0;
  const pct = round ? Math.max(0, Math.min(100, (elapsed / round.durationMs) * 100)) : 0;

  return (
    <Shell>
      {back}
      {(phase === "intro" || phase === "loading") && (
        <div className="slab mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border border-line bg-panel p-6 text-center">
          <Chomper size={88} />
          <h1 className="font-display text-3xl font-bold">Pick your game</h1>
          <p className="max-w-md text-lg text-[#ede8dc]/90">Something is wrong in <span className="font-mono text-accent">{meta.file}</span>: <span className="font-semibold text-white">{meta.symptom}</span></p>
          <p className="max-w-md text-sm text-[#ede8dc]/75">Every game works the same way: lines of code show up, and you go after the ones that cause the bug. Hit a good line and you lose a heart. Three hearts, 30 seconds.</p>
          <div role="radiogroup" aria-label="Game" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {MODES.map((m) => {
              const on = R.mode === m.id;
              return (
                <button key={m.id} role="radio" aria-checked={on} onClick={() => R.setMode(m.id)} disabled={phase === "loading"}
                  className="keycap flex flex-col items-start gap-1 rounded-lg border p-3 text-left hover:brightness-125" style={{ ["--c" as string]: m.color, borderColor: on ? m.color : "rgba(255,255,255,.18)", background: on ? `linear-gradient(180deg, ${m.color}55, ${m.color}22)` : `linear-gradient(180deg, ${m.color}22, ${m.color}0d)` }}>
                  <span className="flex items-center gap-2 font-display text-base font-bold"><m.Icon size={20} style={{ color: m.color }} /> {m.name}</span>
                  <span className="text-sm leading-snug text-[#ede8dc]/85">{m.blurb}</span>
                  <span className="text-xs text-[#ede8dc]/55">{m.how}</span>
                </button>
              );
            })}
          </div>
          {R.error && <p role="alert" className="text-sm text-sev-high">{R.error}</p>}
          <button onClick={() => R.start()} disabled={phase === "loading"} className={btn}>{phase === "loading" ? "Getting ready" : `Play ${cur.name}`}</button>
        </div>
      )}

      {(phase === "playing" || phase === "submitting") && round && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel px-4 py-2">
            <div className="flex gap-1" aria-label={`${R.lives} hearts left`}>{[0, 1, 2].map((i) => <Heart key={i} size={24} className={i < R.lives ? "fill-sev-high text-sev-high" : "text-[#ede8dc]/25"} />)}</div>
            <div className="font-display text-2xl font-bold tabular-nums">{R.score}</div>
            <div className={`flex items-center gap-1 font-display text-lg font-bold ${R.combo > 1 ? "text-accent" : "text-[#ede8dc]/35"}`}><Flame size={20} /> x{Math.max(R.combo, 1)}</div>
            <button onClick={() => R.setSound(!R.sound)} aria-label={R.sound ? "Mute" : "Unmute"} className="text-[#ede8dc]/60 hover:text-accent">{R.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-ok to-accent" style={{ width: `${pct}%` }} /></div>
          <div className="rounded-md border border-sev-high/50 bg-[#2a1250]/70 px-4 py-3 text-center">
            <div className="font-display text-sm font-semibold text-sev-high">Find the line that causes this</div>
            <p className="mt-1 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">{meta.symptom}</p>
          </div>

          <div key={R.shake} className={`relative ${R.shake ? "shake" : ""}`}>
            {countdown > 0 && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-lg bg-[#0a1040]/80">
                <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-8xl font-bold text-accent">{countdown}</motion.div>
                <div className="font-display text-lg font-semibold">{cur.name}</div>
                <div className="text-sm text-[#ede8dc]/75">{cur.how}</div>
              </div>
            )}
            {R.mode === "chomp" && <ChompBoard R={R} />}
            {R.mode === "rain" && <RainBoard R={R} />}
            {R.mode === "hunt" && <HuntBoard R={R} />}
            {R.mode === "pop" && <PopBoard R={R} />}
          </div>
          <p className="text-center text-xs text-[#ede8dc]/50">{phase === "submitting" ? "Scoring your round." : `Catch ${round.goal} or more bugs to unlock the fix.`}</p>
        </div>
      )}

      {phase === "failed" && fail && (
        <div role="alert" className="slab mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-lg border border-sev-high/60 bg-panel p-6 text-center">
          <Chomper size={64} />
          <div className="font-display text-2xl font-bold">{fail.outOfLives ? "Out of hearts" : "Some bugs got away"}</div>
          <p className="text-[#ede8dc]/90">You caught {fail.caught} of {fail.total} bugs{fail.wrong ? ` and hit ${fail.wrong} good line${fail.wrong > 1 ? "s" : ""}` : ""}. Here is what the bug does: {fail.crash}</p>
          {fail.hint && <p className="flex gap-2 text-sm text-sev-medium"><Lightbulb size={16} className="mt-0.5 shrink-0" /> {fail.hint}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => R.start()} className={btn}><RotateCcw size={16} /> Play {cur.name} again</button>
            <button onClick={() => R.setPhase("intro")} className="rounded-md border border-line px-4 py-3 font-display text-sm font-semibold hover:border-accent">Pick another game</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6"><Logo />{children}</main>;
}
