"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flag, Flame, Plus, Play, Zap } from "lucide-react";
import type { GuardId } from "@/lib/levelTypes";
import { Prism as Highlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import GuardIcon, { GUARD_COLOR } from "./GuardIcon";
import BugBot from "./BugBot";

export type BoardStation = { id: string; line: number; code: string };
export type BoardState = { cell: number; caught: string[]; crashed: string | null; done: boolean };

function useCols() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const f = () => setCols(window.innerWidth < 720 ? 2 : 4);
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, []);
  return cols;
}

// Cells run in a snake: left to right, then right to left. Cell 0 is START, the last is EXIT.
const pos = (i: number, cols: number) => { const row = Math.floor(i / cols); const c = i % cols; return { row, col: row % 2 === 0 ? c : cols - 1 - c }; };

const TILE = ["#4FD1C5", "#6EA8FF", "#A78BFA", "#F472B6", "#F5A524", "#6EE7A0"];

export default function Board({ stations, placements, selected, state, onSocket }: {
  stations: BoardStation[]; placements: Record<string, GuardId>; selected: GuardId | null; state: BoardState; onSocket: (id: string) => void;
}) {
  const cols = useCols();
  const total = stations.length + 2;
  const rows = Math.ceil(total / cols);
  const center = (i: number) => { const p = pos(i, cols); return { x: (p.col + 0.5) / cols, y: (p.row + 0.055) / rows }; };
  const points = Array.from({ length: total }, (_, i) => center(i));
  const bot = points[Math.min(state.cell, total - 1)];
  const CELL = cols === 2 ? 150 : 158;

  return (
    <div className={`ticks relative rounded-md border bg-panel p-3 pt-8 transition-colors duration-300 ${state.crashed ? "border-sev-high/70" : state.done ? "border-ok/60" : "border-line"}`} style={{ height: rows * CELL + 56 }}>
      <div className="relative h-full w-full">
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${cols * 100} ${rows * 100}`} preserveAspectRatio="none" aria-hidden>
          <defs><linearGradient id="trk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4FD1C5" /><stop offset=".5" stopColor="#A78BFA" /><stop offset="1" stopColor="#F472B6" /></linearGradient></defs>
          <polyline points={points.map((p) => `${p.x * cols * 100},${p.y * rows * 100}`).join(" ")} fill="none"
            stroke="url(#trk)" strokeOpacity=".85" strokeWidth="2.5" strokeDasharray="4 7" vectorEffect="non-scaling-stroke" className="path-flow" />
        </svg>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {Array.from({ length: total }, (_, i) => {
            const p = pos(i, cols);
            const place = { gridColumn: p.col + 1, gridRow: p.row + 1 };
            if (i === 0) return (
              <div key="start" style={place} className="flex items-center justify-center">
                <div className="mt-10 flex flex-col items-center gap-1 text-[#6EE7A0]"><Play size={20} /><span className="font-mono text-xs">start</span></div>
              </div>
            );
            if (i === total - 1) return (
              <div key="exit" style={place} className="flex items-center justify-center">
                <div className={`mt-8 flex flex-col items-center gap-1 rounded-md border px-4 py-3 transition-colors ${state.done ? "border-ok bg-ok/10 text-ok" : "border-accent/70 bg-accent/10 text-accent shadow-[0_0_24px_rgba(214,178,94,.25)]"}`}>
                  <Flag size={20} /><span className="font-mono text-xs">{state.done ? "contained" : "exit"}</span>
                </div>
              </div>
            );
            const s = stations[i - 1];
            const g = placements[s.id];
            const caught = state.caught.includes(s.id);
            const crashed = state.crashed === s.id;
            return (
              <div key={s.id} style={place} className="flex items-center justify-center p-2">
                <motion.div animate={crashed ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.45 }}
                  className={`relative flex h-full w-full max-w-[210px] flex-col justify-between rounded-md border p-2 transition-colors ${
                    crashed ? "border-sev-high bg-[#2a1520]" : caught ? "border-ok bg-[#0c2a30]" : "border-line bg-[#0c1428]"}`}>
                  {crashed && [0, 0.18].map((d) => (
                    <motion.span key={d} aria-hidden className="pointer-events-none absolute inset-0 rounded-md border-2 border-sev-high"
                      initial={{ opacity: 0.95, scale: 1 }} animate={{ opacity: 0, scale: 1.5 }} transition={{ duration: 0.8, delay: d, ease: "easeOut" }} />
                  ))}
                  {crashed && (
                    <motion.span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 text-sev-high" style={{ translate: "-50% -50%" }}
                      initial={{ opacity: 1, scale: 0.4 }} animate={{ opacity: 0, scale: 3 }} transition={{ duration: 0.7 }}><Zap size={34} /></motion.span>
                  )}
                  {caught && (
                    <motion.span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 h-9 w-9 rounded-full border-2 border-ok" style={{ translate: "-50% 0" }}
                      initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 3.2 }} transition={{ duration: 0.9, ease: "easeOut" }} />
                  )}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-md" style={{ background: crashed ? "#FF5A36" : caught ? "#4FD1C5" : TILE[(i - 1) % TILE.length] }} />
                  <div className="flex items-center justify-between font-mono text-[11px] text-[#ede8dc]/55">
                    <span>line {s.line}</span>
                    {crashed && <Flame size={14} className="text-sev-high" />}
                  </div>
                  <Highlighter language="typescript" style={oneDark} PreTag="div" codeTagProps={{ style: { background: "transparent", fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" } }}
                    customStyle={{ background: "transparent", margin: 0, padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden", maxHeight: "3.9em", lineHeight: 1.3 }}>{s.code}</Highlighter>
                  <button type="button" onClick={() => onSocket(s.id)} aria-label={g ? `Remove guard from line ${s.line}` : `Attach guard to line ${s.line}`}
                    className={`socket mx-auto flex h-9 w-9 items-center justify-center transition-transform hover:scale-110 focus-visible:scale-110 ${
                      g ? "text-[#0a0f1e]" : selected ? "animate-pulse" : "bg-white/10 text-[#ede8dc]/50"}`}
                    style={g ? { background: caught ? "#4FD1C5" : GUARD_COLOR[g] } : selected ? { background: `${GUARD_COLOR[selected]}33`, color: GUARD_COLOR[selected] } : undefined}>
                    {g ? <GuardIcon id={g} size={17} className="text-[#0a0f1e]" /> : <Plus size={16} />}
                  </button>
                </motion.div>
              </div>
            );
          })}
        </div>
        <motion.div className="pointer-events-none absolute z-10" initial={false}
          animate={{ left: `${bot.x * 100}%`, top: `${bot.y * 100}%`, opacity: state.crashed ? 0 : 1, scale: state.crashed ? 1.8 : 1 }}
          transition={{ left: { duration: 0.55, ease: "easeInOut" }, top: { duration: 0.55, ease: "easeInOut" }, opacity: { duration: 0.35 }, scale: { duration: 0.35 } }}
          style={{ translate: "-50% -50%" }}>
          <BugBot size={46} state={state.done ? "caught" : "idle"} />
        </motion.div>
      </div>
    </div>
  );
}
