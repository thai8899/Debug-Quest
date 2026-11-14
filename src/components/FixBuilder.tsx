"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Play, GripVertical } from "lucide-react";
import CodeBlock from "./CodeBlock";

// Drag (or tap) a code block into the slot, then run it. Grading still happens on the server.
export default function FixBuilder({ code, options, disabled, onSubmit }: {
  code: string; options: string[]; disabled: boolean; onSubmit: (i: number) => void;
}) {
  const [placed, setPlaced] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);

  function run() {
    if (placed === null || running || disabled) return;
    setRunning(true);
    setTimeout(() => onSubmit(placed), 900);
  }
  const place = (i: number) => { if (!running && !disabled) setPlaced(i); };

  return (
    <div className="flex flex-col gap-4">
      {code && <div className="ticks"><CodeBlock code={code} /></div>}

      <div>
        <div className="mb-2 text-sm text-[#ede8dc]/60">Drag a block into the slot, or select one.</div>
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const i = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!Number.isNaN(i)) place(i); }}
          onClick={() => !running && setPlaced(null)}
          className={`min-h-14 rounded-md border border-dashed p-4 font-mono text-sm transition ${over ? "border-accent bg-accent/10" : placed !== null ? "border-accent/70 bg-panel" : "border-line"}`}>
          {placed !== null ? options[placed] : <span className="text-[#ede8dc]/40">Fix goes here</span>}
        </div>
      </div>

      <div className="grid gap-2">
        {options.map((o, i) => (
          <div key={i} draggable={!running && !disabled}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onClick={() => place(i)}
            className={`flex cursor-grab items-center gap-3 rounded-md border bg-panel px-3 py-3 font-mono text-sm active:cursor-grabbing ${placed === i ? "border-accent/60 opacity-50" : "border-line hover:border-accent/60"}`}>
            <GripVertical size={16} className="shrink-0 text-[#ede8dc]/40" /> {o}
          </div>
        ))}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <motion.div className="h-full bg-accent" initial={{ width: 0 }} animate={{ width: running ? "100%" : 0 }} transition={{ duration: 0.85, ease: "easeInOut" }} />
      </div>

      <button onClick={run} disabled={placed === null || running || disabled}
        className="inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-5 py-3 font-display text-sm font-semibold text-[#1a1203] hover:brightness-110 disabled:opacity-40">
        <Play size={14} /> {running ? "Running fix" : "Run fix"}
      </button>
    </div>
  );
}
