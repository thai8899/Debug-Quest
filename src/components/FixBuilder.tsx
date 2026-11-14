"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Play, GripVertical } from "lucide-react";
import Mascot from "./Mascot";
import CodeBlock from "./CodeBlock";

// Drag (or tap) a code block into the slot, then press RUN. Grading still happens on the server.
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
      {code && <CodeBlock code={code} />}

      <div>
        <div className="mb-2 text-xs uppercase tracking-wide opacity-60">Your fix (drag a block here, or tap one)</div>
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const i = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!Number.isNaN(i)) place(i); }}
          onClick={() => !running && setPlaced(null)}
          className={`min-h-16 rounded-xl border-2 border-dashed p-4 font-mono text-sm transition ${over ? "border-accent bg-accent/10" : placed !== null ? "border-accent bg-panel" : "border-line"}`}>
          {placed !== null ? options[placed] : <span className="opacity-40">Empty slot</span>}
        </div>
      </div>

      <div className="grid gap-3">
        {options.map((o, i) => (
          <div key={i} draggable={!running && !disabled}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onClick={() => place(i)}
            className={`chunky flex cursor-grab items-center gap-2 rounded-2xl border-2 bg-panel p-3 font-mono text-sm active:cursor-grabbing ${placed === i ? "border-accent opacity-50" : "border-line hover:border-accent"}`}>
            <GripVertical size={16} className="shrink-0 opacity-40" /> {o}
          </div>
        ))}
      </div>

      <div className="relative h-16 overflow-hidden rounded-xl bg-[#10102a]">
        <div className="absolute inset-x-0 bottom-3 h-px bg-line" />
        <motion.div className="absolute bottom-2 left-2" animate={{ left: running ? "calc(100% - 3.5rem)" : "0.5rem" }} transition={{ duration: 0.85, ease: "easeIn" }}>
          <Mascot size={52} mood={running ? "run" : placed !== null ? "happy" : "idle"} />
        </motion.div>
        <div className="absolute bottom-3 right-3 text-xs opacity-50">🏁</div>
      </div>

      <button onClick={run} disabled={placed === null || running || disabled}
        className="chunky inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-pixel text-[10px] text-black hover:brightness-110 disabled:opacity-40">
        <Play size={14} /> {running ? "RUNNING..." : "RUN FIX"}
      </button>
    </div>
  );
}
