"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import type { Bug } from "@/lib/contract";
import CodeBlock from "./CodeBlock";
import Mascot from "./Mascot";

// The one big motion moment: the seal breaks (rings expand from the emblem), then the fix is revealed.
export default function UnlockReveal({ bug, xp }: { bug: Bug; xp: number }) {
  const [open, setOpen] = useState(false);
  const [deep, setDeep] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOpen(true), 650); return () => clearTimeout(t); }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col items-center gap-3 py-6">
        {open && [0, 0.25].map((d) => (
          <motion.span key={d} className="absolute top-6 h-24 w-24 rounded-full border border-ok" initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 3.2, opacity: 0 }} transition={{ duration: 1.4, delay: d, ease: "easeOut" }} />
        ))}
        <Mascot size={96} mood={open ? "happy" : "idle"} />
        <div className="font-display text-2xl font-bold">{open ? "Fix unlocked" : "Containing the bug"}</div>
        {open && xp > 0 && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono text-ok">+{xp} XP</motion.div>
        )}
      </div>

      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-col gap-5">
          <div className="rounded-md border border-line bg-panel p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">What went wrong</h3>
              <button onClick={() => setDeep(!deep)} className="rounded-sm border border-line px-2 py-1 text-xs hover:border-accent">
                {deep ? "Plain English" : "Technical version"}
              </button>
            </div>
            <p className="leading-relaxed text-[#ede8dc]/90">{deep ? bug.explainDeep : bug.explainSimple}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-sev-high">Before</div>
              <CodeBlock code={bug.originalCode} />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-ok">After</div>
              <CodeBlock code={bug.fixedCode} />
            </div>
          </div>

          {bug.sources?.[0] && (
            <a href={bug.sources[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-sev-low hover:underline">
              <ExternalLink size={14} /> Read the docs
            </a>
          )}
        </motion.div>
      )}
    </div>
  );
}
