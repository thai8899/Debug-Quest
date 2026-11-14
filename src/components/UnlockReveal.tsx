"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, LockOpen, ExternalLink } from "lucide-react";
import type { Bug } from "@/lib/contract";
import CodeBlock from "./CodeBlock";

export default function UnlockReveal({ bug, xp }: { bug: Bug; xp: number }) {
  const [open, setOpen] = useState(false);
  const [deep, setDeep] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 700);
    const c = setTimeout(async () => {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.4 }, colors: ["#00e5a0", "#ffb84d", "#5db3ff", "#ffffff"] });
    }, 800);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 py-4">
        <motion.div animate={open ? { scale: [1, 1.4, 1], rotate: [0, -12, 0] } : { x: [0, -6, 6, -6, 6, 0] }} transition={{ duration: 0.6 }}>
          {open ? <LockOpen size={72} className="text-accent" /> : <Lock size={72} className="text-sev-medium" />}
        </motion.div>
        {open && xp > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-pixel text-accent text-lg">+{xp} XP</motion.div>
        )}
        <div className="font-pixel text-xs">{open ? "FIX UNLOCKED" : "UNLOCKING..."}</div>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex flex-col gap-5">
          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-pixel text-[10px] text-accent">WHAT WENT WRONG</h3>
              <button onClick={() => setDeep(!deep)} className="rounded border border-line px-2 py-1 text-xs hover:border-accent">
                {deep ? "Explain simply" : "Explain like I'm experienced"}
              </button>
            </div>
            <p className="leading-relaxed">{deep ? bug.explainDeep : bug.explainSimple}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs uppercase text-sev-high">Before</div>
              <CodeBlock code={bug.originalCode} />
            </div>
            <div>
              <div className="mb-2 text-xs uppercase text-accent">After</div>
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
