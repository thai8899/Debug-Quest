"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { GitPullRequest } from "lucide-react";
import type { Scan } from "@/lib/contract";
import LockedCard from "@/components/LockedCard";
import Mascot from "@/components/Mascot";
import SpeechBubble from "@/components/SpeechBubble";

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    async function load() {
      const r = await fetch(`/api/scan/${id}`);
      if (!r.ok) return setError("Scan not found");
      const s: Scan = await r.json();
      if (stop) return;
      setScan(s);
      if (s.status === "running") setTimeout(load, 3000);
    }
    load();
    return () => { stop = true; };
  }, [id]);

  if (error) return <Shell><p className="text-sev-high">{error}</p></Shell>;
  if (!scan || scan.status === "running")
    return (
      <Shell>
        <div className="mt-12 flex flex-col items-center text-center">
          <Mascot size={110} mood="run" />
          <div className="mt-4 font-pixel text-sm">HUNTING BUGS...</div>
          <div className="mx-auto mt-6 h-3 w-72 overflow-hidden rounded-full bg-line">
            <motion.div className="h-full w-1/3 rounded-full bg-accent" animate={{ x: [-100, 260] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} />
          </div>
        </div>
      </Shell>
    );
  if (scan.status === "error") return <Shell><p className="text-sev-high">The scan failed. Try another repo.</p></Shell>;

  const locked = scan.bugs.filter((b) => b.locked).length;
  return (
    <Shell>
      <div className="mb-4 flex items-center gap-3">
        <Mascot size={80} mood={locked ? "idle" : "happy"} />
        <SpeechBubble>{locked ? `I found ${scan.bugs.length} bugs! Play to unlock the fixes.` : "ROAR! Every fix is yours!"}</SpeechBubble>
      </div>
      <p className="mb-4 text-sm opacity-70">{scan.repoUrl.replace("https://github.com/", "")}</p>
      {scan.testsBefore && scan.testsAfter && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <span className="font-pixel text-xs text-accent">TESTS: {scan.testsBefore.fail} FAILING <span className="font-sans">→</span> {scan.testsAfter.fail} FAILING</span>
        </div>
      )}
      {scan.prUrl && (
        <a href={scan.prUrl} target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-2 text-sm text-sev-low hover:underline">
          <GitPullRequest size={16} /> Pull request on {scan.fixBranch} (main untouched)
        </a>
      )}
      <h2 className="mb-2 font-pixel text-xs">{scan.bugs.length} BUGS FOUND · {locked} LOCKED</h2>
      <div className="mb-4 h-2 w-full max-w-xs rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${scan.bugs.length ? ((scan.bugs.length - locked) / scan.bugs.length) * 100 : 0}%` }} />
      </div>
      {scan.bugs.length > 0 && locked === 0 && (
        <div className="mb-4 rounded-xl border border-accent bg-accent/10 p-4 text-sm">
          <b className="font-pixel text-[10px] text-accent">ALL FIXES EARNED</b>
          <p className="mt-2">You understand every bug, so the pull request is ready to review and merge.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scan.bugs.map((b) => <LockedCard key={b.id} bug={b} />)}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 font-pixel text-lg text-accent">DEBUG QUEST</h1>
      {children}
    </main>
  );
}
