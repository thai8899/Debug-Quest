"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Chomper from "@/components/Chomper";
import type { PublicSpawn } from "@/lib/levelTypes";
import type { RoundApi } from "./useRound";

export const COLORS = ["#ff7eb6", "#4fe3d4", "#ffb347", "#a78bfa", "#8ee36a", "#6ea8ff"];
const live = (R: RoundApi, sp: PublicSpawn) => R.elapsed >= sp.at && R.elapsed < sp.at + sp.show && !R.done[sp.id];
const boardH = { height: "clamp(330px, calc(100dvh - 450px), 540px)" } as const;

const Eyes = () => (
  <span className="flex gap-2" aria-hidden>
    {[0, 1].map((i) => <span key={i} className="flex h-3 w-2.5 items-end justify-center rounded-full bg-white"><span className="mb-px h-1.5 w-1.5 rounded-full bg-[#1b1f4d]" /></span>)}
  </span>
);
const Sign = ({ code }: { code: string }) => (
  <span className="w-full min-w-0 [overflow-wrap:anywhere] rounded-sm bg-[#0e1445]/80 px-1.5 py-0.5 text-left font-mono text-[11px] font-semibold leading-tight text-[#f4f1e4] chomp-code"
    style={{ display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{code}</span>
);

// Floating score text and candy bursts at a point (rain, hunt) in percent of the board.
function Fx({ R }: { R: RoundApi }) {
  return (
    <>
      <AnimatePresence>
        {R.floaters.filter((f) => f.pos).map((f) => (
          <motion.div key={f.key} className={`pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap font-display text-lg font-bold drop-shadow ${f.tone === "good" ? "text-accent" : "text-sev-high"}`}
            style={{ left: `${f.pos!.x}%`, top: `${f.pos!.y}%` }} initial={{ y: 0, opacity: 0, scale: 0.7 }} animate={{ y: -40, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}>{f.text}</motion.div>
        ))}
      </AnimatePresence>
      {R.chomps.filter((c) => c.pos && c.ok).map((c) => <Burst key={`b${c.id}`} style={{ left: `${c.pos!.x}%`, top: `${c.pos!.y}%` }} />)}
    </>
  );
}
function Burst({ style }: { style: React.CSSProperties }) {
  return (
    <div className="pointer-events-none absolute z-20" style={style} aria-hidden>
      {COLORS.concat(COLORS).map((c, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <motion.span key={i} className="absolute h-2.5 w-2.5 rounded-full" style={{ background: c }} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * 46, y: Math.sin(a) * 46, opacity: 0, scale: 0.3 }} transition={{ duration: 0.6 }} />;
      })}
    </div>
  );
}

// ---------- Bug Chomp: whack-a-mole in nine holes ----------
export function ChompBoard({ R }: { R: RoundApi }) {
  const spawns = R.round!.spawns;
  useEffect(() => {
    if (R.phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const h = Number(e.key) - 1;
      if (!(h >= 0 && h < 9)) return;
      const sp = spawns.find((x) => x.hole === h && live(R, x));
      if (sp) R.hit(sp);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="relative grid grid-cols-3 gap-x-3 gap-y-3 rounded-lg border border-line bg-black/20 p-3 pt-4">
      {Array.from({ length: 9 }, (_, h) => {
        const sp = spawns.find((x) => x.hole === h && live(R, x));
        const eaten = R.chomps.find((x) => x.hole === h);
        const col = COLORS[(sp?.id ?? 0) % COLORS.length];
        return (
          <div key={h} className="relative chomp-cell">
            <div className="hole-back absolute bottom-1 left-0 right-0 h-10 rounded-[50%]" />
            <div className="absolute inset-x-0 top-0 bottom-5 overflow-hidden">
              <AnimatePresence>
                {sp && (
                  <motion.button key={sp.id} type="button" aria-label={`Hole ${h + 1}: ${sp.code}`} onClick={() => R.hit(sp)}
                    initial={{ y: "105%" }} animate={{ y: 0 }} exit={{ y: "105%" }} transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="ghost3d absolute inset-x-1 bottom-0 flex chomp-ghost cursor-pointer flex-col items-center gap-0.5 rounded-t-[40px] rounded-b-md px-1.5 pt-2"
                    style={{ background: `linear-gradient(180deg, ${col}, ${col}dd)`, ["--g" as string]: col }}>
                    <Eyes /><Sign code={sp.code} />
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
              {R.floaters.filter((f) => f.hole === h && !f.pos).map((f) => (
                <motion.div key={f.key} className={`pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap font-display text-lg font-bold drop-shadow ${f.tone === "good" ? "text-accent" : "text-sev-high"}`} initial={{ y: 10, opacity: 0, scale: 0.7 }} animate={{ y: -34, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}>{f.text}</motion.div>
              ))}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Code Rain: steer the lion under falling lines ----------
export function RainBoard({ R }: { R: RoundApi }) {
  const [lane, setLane] = useState(1);
  const laneRef = useRef(1);
  const go = (l: number) => { const n = Math.max(0, Math.min(2, l)); laneRef.current = n; setLane(n); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") go(laneRef.current - 1);
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") go(laneRef.current + 1);
      if (["1", "2", "3"].includes(e.key)) go(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  // the lion eats whatever line lands on it
  useEffect(() => {
    if (R.phase !== "playing") return;
    for (const sp of R.round!.spawns) {
      if (sp.hole !== laneRef.current || !live(R, sp)) continue;
      const y = (R.elapsed - sp.at) / sp.show;
      if (y > 0.74 && y < 0.98) R.hit(sp, { x: (laneRef.current + 0.5) * (100 / 3), y: 80 });
    }
  }, [R.elapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-black/25" style={boardH}>
      <div className="absolute inset-0 grid grid-cols-3">
        {[0, 1, 2].map((l) => (
          <button key={l} type="button" aria-label={`Move to lane ${l + 1}`} onPointerDown={() => go(l)}
            className={`border-r border-white/10 last:border-r-0 ${lane === l ? "bg-white/[0.07]" : ""}`} />
        ))}
      </div>
      {R.round!.spawns.filter((sp) => live(R, sp)).map((sp) => {
        const y = (R.elapsed - sp.at) / sp.show;
        const col = COLORS[sp.id % COLORS.length];
        return (
          <div key={sp.id} data-rain className="pointer-events-none absolute w-[30%] rounded-lg px-1.5 py-1.5 shadow-lg" aria-hidden
            style={{ left: `${sp.hole * (100 / 3) + 1.6}%`, top: `${y * 100 - 14}%`, background: `linear-gradient(180deg, ${col}, ${col}cc)`, boxShadow: "0 5px 0 rgba(3,8,40,.4)" }}>
            <Sign code={sp.code} />
          </div>
        );
      })}
      <div className="pointer-events-none absolute bottom-1 z-10 -translate-x-1/2 transition-[left] duration-150" style={{ left: `${(lane + 0.5) * (100 / 3)}%` }}>
        <Chomper size={72} />
      </div>
      <Fx R={R} />
    </div>
  );
}

// ---------- Ghost Hunt: chase drifting ghosts ----------
const drift = (id: number, t: number) => {
  const fx = 0.5 + ((id * 7) % 5) * 0.09, fy = 0.42 + ((id * 3) % 5) * 0.08;
  return { x: 50 + 30 * Math.sin(t * fx + id * 1.7), y: 50 + 27 * Math.sin(t * fy + id * 2.3 + 1) };
};
export function HuntBoard({ R }: { R: RoundApi }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-black/25" style={boardH}>
      {R.round!.spawns.filter((sp) => live(R, sp)).map((sp) => {
        const age = (R.elapsed - sp.at) / 1000;
        const { x, y } = drift(sp.id, age);
        const col = COLORS[sp.id % COLORS.length];
        return (
          <button key={sp.id} type="button" aria-label={`Ghost: ${sp.code}`} onClick={() => R.hit(sp, { x, y })}
            className="ghost3d absolute flex cursor-crosshair flex-col items-center gap-0.5 rounded-t-[36px] rounded-b-md px-1.5 pt-2 pb-1"
            style={{ left: `${x}%`, top: `${y}%`, width: "clamp(120px, 27%, 170px)", transform: "translate(-50%,-50%)", opacity: Math.min(1, age / 0.35), transition: "left 60ms linear, top 60ms linear", background: `linear-gradient(180deg, ${col}, ${col}dd)`, ["--g" as string]: col }}>
            <Eyes /><Sign code={sp.code} />
          </button>
        );
      })}
      <AnimatePresence>
        {R.chomps.filter((c) => c.pos).map((c) => (
          <motion.div key={`l${c.id}`} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2" initial={{ left: "50%", top: "105%", scale: 0.6 }} animate={{ left: `${c.pos!.x}%`, top: `${c.pos!.y}%`, scale: 1.1 }} exit={{ opacity: 0, scale: 0.4 }} transition={{ duration: 0.22 }}>
            <Chomper size={72} />
          </motion.div>
        ))}
      </AnimatePresence>
      <Fx R={R} />
    </div>
  );
}

// ---------- Bug Pop: clear four candy boards ----------
export function PopBoard({ R }: { R: RoundApi }) {
  const spawns = R.round!.spawns;
  const e = R.elapsed - 300;
  const r = Math.max(0, Math.min(3, Math.floor(e / 7000)));
  const into = e - r * 7000;
  const open = e >= 0 && into < 6500;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm text-[#ede8dc]/80">
        <span className="font-display font-semibold text-white">Board {r + 1} of 4</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-[#ff7eb6] to-[#ffc94d]" style={{ width: `${open ? Math.min(100, (into / 6500) * 100) : 100}%` }} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-line bg-black/20 p-3 sm:grid-cols-4">
        {Array.from({ length: 12 }, (_, tile) => {
          const sp = open ? spawns.find((x) => x.hole === tile && x.at === 300 + r * 7000 && live(R, x)) : undefined;
          const col = COLORS[(tile + r) % COLORS.length];
          const popped = R.chomps.find((c) => c.hole === tile && c.ok);
          return (
            <div key={tile} className="relative" style={{ minHeight: 84 }}>
              <AnimatePresence>
                {sp && (
                  <motion.button key={sp.id} type="button" aria-label={`Tile: ${sp.code}`} onClick={() => R.hit(sp)}
                    initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 12 }} transition={{ type: "spring", stiffness: 360, damping: 20, delay: tile * 0.02 }}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl p-1.5"
                    style={{ background: `radial-gradient(circle at 30% 25%, #ffffff66, transparent 40%), linear-gradient(160deg, ${col}, ${col}bb)`, boxShadow: `0 5px 0 ${col}88, 0 9px 12px rgba(3,8,40,.45), inset 0 2px 0 rgba(255,255,255,.5)` }}>
                    <Sign code={sp.code} />
                  </motion.button>
                )}
              </AnimatePresence>
              {popped && <Burst style={{ left: "50%", top: "50%" }} />}
              <AnimatePresence>
                {R.floaters.filter((f) => f.hole === tile && !f.pos).map((f) => (
                  <motion.div key={f.key} className={`pointer-events-none absolute left-1/2 top-1/3 z-20 -translate-x-1/2 whitespace-nowrap font-display text-base font-bold drop-shadow ${f.tone === "good" ? "text-accent" : "text-sev-high"}`} initial={{ y: 0, opacity: 0 }} animate={{ y: -30, opacity: 1 }} exit={{ opacity: 0 }}>{f.text}</motion.div>
                ))}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
