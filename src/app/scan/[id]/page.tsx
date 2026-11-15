"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { GitPullRequest } from "lucide-react";
import type { Scan } from "@/lib/contract";
import LockedCard from "@/components/LockedCard";
import Mascot from "@/components/Mascot";
import SpeechBubble from "@/components/SpeechBubble";
import Logo from "@/components/Logo";
import { PlaytesterPanel } from "@/components/PlaytesterPanel";

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    async function load() {
      const r = await fetch(`/api/scan/${id}`);
      if (!r.ok) return setError("Scan not found. Check the link or start a new scan.");
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
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <Mascot size={96} mood="run" />
          <div className="font-display text-2xl font-bold">Scanning repository</div>
          <p className="text-sm text-[#ede8dc]/70">{scan?.step ?? "Gemini is reading the code and running the tests."}</p>
          <div className="h-1.5 w-72 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full w-1/3 bg-accent" animate={{ x: [-100, 260] }} transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }} />
          </div>
        </div>
      </Shell>
    );
  if (scan.status === "error") return <Shell><p role="alert" className="text-sev-high">The scan failed. {scan.error ?? "Try another repository."}</p></Shell>;

  const locked = scan.bugs.filter((b) => b.locked).length;
  const stat = "rounded-md border border-line bg-panel p-4";
  return (
    <Shell>
      <div className="mb-6 flex items-center gap-4">
        <Mascot size={56} mood={locked ? "idle" : "happy"} />
        <SpeechBubble>{locked ? `${scan.bugs.length} bugs found. Pass each challenge to unlock its fix.` : "All fixes unlocked. The pull request is ready to review."}</SpeechBubble>
      </div>
      <h1 className="mb-1 font-display text-3xl font-bold">{scan.repoUrl.replace("https://github.com/", "")}</h1>
      {scan.prUrl && (
        <a href={scan.prUrl} target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-2 text-sm text-sev-low hover:underline">
          <GitPullRequest size={16} /> Pull request on {scan.fixBranch}. Main is untouched.
        </a>
      )}
      <div className="mb-8 mt-4 grid gap-3 sm:grid-cols-3">
        {scan.testsBefore && scan.testsAfter && (
          <div className={stat}>
            <div className="text-sm text-[#ede8dc]/60">Failing tests</div>
            <div className="mt-1 font-display text-3xl font-bold"><span className="text-sev-high">{scan.testsBefore.fail}</span> <span className="text-[#ede8dc]/40">to</span> <span className="text-ok">{scan.testsAfter.fail}</span></div>
          </div>
        )}
        <div className={stat}>
          <div className="text-sm text-[#ede8dc]/60">Bugs found</div>
          <div className="mt-1 font-display text-3xl font-bold">{scan.bugs.length}</div>
        </div>
        <div className={stat}>
          <div className="text-sm text-[#ede8dc]/60">Fixes unlocked</div>
          <div className="mt-1 font-display text-3xl font-bold">{scan.bugs.length - locked} <span className="text-[#ede8dc]/40">of {scan.bugs.length}</span></div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-ok transition-all" style={{ width: `${scan.bugs.length ? ((scan.bugs.length - locked) / scan.bugs.length) * 100 : 0}%` }} /></div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scan.playtest && <div className="sm:col-span-full"><PlaytesterPanel playtest={scan.playtest} /></div>}
        {scan.bugs.map((b) => <LockedCard key={b.id} bug={b} />)}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <Logo />
      {children}
    </main>
  );
}
