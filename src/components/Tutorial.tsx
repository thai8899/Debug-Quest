"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Bug } from "@/lib/contract";
import type { ReviewItem } from "@/lib/levelTypes";
import { diffLines, type DiffLine } from "@/lib/diffLines";

const BG = { same: "transparent", del: "rgba(255,107,74,.22)", add: "rgba(56,232,198,.20)" } as const;
const MARK = { same: " ", del: "-", add: "+" } as const;
const MARK_COLOR = { same: "rgba(237,232,220,.35)", del: "#ff6b4a", add: "#38e8c6" } as const;

function Lines({ lines, start }: { lines: DiffLine[]; start: number }) {
  return (
    <pre className="m-0 overflow-x-auto rounded-md border border-line bg-[#0a1122] py-2 font-mono text-[13px] leading-[1.7]">
      {lines.map((l, i) => {
        const n = (l.type === "add" ? l.after! : l.before!) + start;
        return (
          <div key={i} className="flex px-3" style={{ background: BG[l.type] }}>
            <span className="w-8 shrink-0 select-none text-right opacity-35">{n}</span>
            <span className="w-5 shrink-0 select-none text-center font-bold" style={{ color: MARK_COLOR[l.type] }}>{MARK[l.type]}</span>
            <span className="whitespace-pre text-[#e6ecff]">{l.text || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}

// A five-step walkthrough of the bug: what you saw, where it is, why it breaks, the fix, and how to spot it next time.
export default function Tutorial({ bug, symptom, review }: { bug: Bug; symptom?: string; review?: ReviewItem[] }) {
  const [step, setStep] = useState(0);
  const [deep, setDeep] = useState(false);
  const diff = useMemo(() => diffLines(bug.originalCode, bug.fixedCode), [bug]);
  const start = bug.lineRelative ? 1 : bug.lineStart;
  const bad = diff.filter((l) => l.type === "del");
  const added = diff.filter((l) => l.type === "add");
  const before = diff.filter((l) => l.type !== "add");
  const badLines = bad.map((l) => (l.before ?? 0) + start);
  const guard = review?.find((r) => r.guard);

  const steps: { title: string; body: React.ReactNode }[] = [
    { title: "What you saw", body: (
      <div className="flex flex-col gap-3">
        <p className="text-lg text-white">{symptom ?? "Something in this file does not behave the way it should."}</p>
        <p className="text-[#ede8dc]/80">The problem lives in <span className="font-mono text-accent">{bug.file}</span>. This kind of bug is called <span className="font-semibold text-white">{bug.category}</span>.</p>
      </div>) },
    { title: "Find the buggy line", body: (
      <div className="flex flex-col gap-3">
        <Lines lines={before} start={start} />
        <p className="text-[#ede8dc]/85">{badLines.length ? <>The highlighted {badLines.length > 1 ? "lines are" : "line is"} the culprit: <span className="font-mono text-sev-high">line {badLines.join(", ")}</span>.</> : "Read the code from top to bottom and look at what each line assumes."}</p>
      </div>) },
    { title: "Why it breaks", body: (
      <div className="flex flex-col gap-3">
        <p className="leading-relaxed text-[#ede8dc]/90">{deep ? bug.explainDeep : bug.explainSimple}</p>
        {review?.map((r) => <p key={r.line} className="rounded-md border border-line bg-black/20 p-3 text-sm text-[#ede8dc]/85"><span className="font-mono text-accent">line {r.line}</span> {r.why}</p>)}
        <button onClick={() => setDeep(!deep)} className="w-fit rounded-sm border border-line px-2 py-1 text-xs hover:border-accent">{deep ? "Plain English" : "Technical version"}</button>
      </div>) },
    { title: "The fix", body: (
      <div className="flex flex-col gap-3">
        <Lines lines={diff} start={start} />
        <p className="text-[#ede8dc]/85">Red lines are removed and green lines are added. {added.length ? `The fix changes ${bad.length || added.length} line${(bad.length || added.length) > 1 ? "s" : ""}.` : ""}</p>
      </div>) },
    { title: "Spot it next time", body: (
      <div className="flex flex-col gap-3">
        {guard && <p className="text-[#ede8dc]/90"><span className="font-semibold text-accent">{guard.guard}.</span> {guard.guardDesc}</p>}
        <p className="text-[#ede8dc]/85">When code deals with <span className="font-semibold text-white">{bug.category}</span>, slow down on the line that touches it and ask: what does this line assume, and what happens when that is not true?</p>
        {bug.sources?.[0] && <a href={bug.sources[0]} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 text-sm text-sev-low hover:underline"><ExternalLink size={14} /> Read the docs</a>}
      </div>) },
  ];
  const last = step === steps.length - 1;

  return (
    <section className="rounded-lg border border-line bg-panel p-4" aria-label="Tutorial">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-bold">Tutorial: how this fix works</h3>
        <span className="font-mono text-xs text-[#ede8dc]/55">Step {step + 1} of {steps.length}</span>
      </div>
      <div className="mb-4 flex gap-1.5" role="tablist" aria-label="Tutorial steps">
        {steps.map((s, i) => (
          <button key={s.title} role="tab" aria-selected={i === step} aria-label={s.title} onClick={() => setStep(i)} className="h-2 flex-1 rounded-full" style={{ background: i <= step ? "#ffc94d" : "rgba(255,255,255,.18)" }} />
        ))}
      </div>
      <div className="min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.18 }}>
            <h4 className="mb-2 font-display text-lg font-semibold text-accent">{steps[step].title}</h4>
            {steps[step].body}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm hover:border-accent disabled:opacity-30"><ArrowLeft size={16} /> Back</button>
        {!last && <button onClick={() => setStep(step + 1)} className="btn3d inline-flex items-center gap-2 rounded-md px-4 py-2 font-display text-sm font-bold text-[#2a1a00]">Next <ArrowRight size={16} /></button>}
      </div>
    </section>
  );
}
