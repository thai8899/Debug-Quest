"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ScanSearch, Gamepad2, LockOpen } from "lucide-react";
import Mascot from "@/components/Mascot";
import Logo from "@/components/Logo";

const STEPS = [
  { icon: ScanSearch, color: "#38E8C6", title: "Scan", text: "Paste a GitHub repo. Gemini finds the bugs and fixes them on a new branch. Your main branch is never touched." },
  { icon: Gamepad2, color: "#B79BFF", title: "Play", text: "The fix is locked. Spot where the code breaks and place the right guard to trap the bug." },
  { icon: LockOpen, color: "#FFC94D", title: "Unlock", text: "Beat the level and the fix opens with a plain-English explanation of what went wrong." },
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: url.trim() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not start the scan.");
      router.push(`/scan/${j.id}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not start the scan.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-6">
      <Logo />
      <section className="flex flex-col items-center gap-5 pt-4 text-center">
        <Mascot size={110} mood={busy ? "run" : "idle"} />
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">Your AI did the work.<br />Now earn it.</h1>
        <p className="max-w-xl text-lg text-[#f7f3e8]/80">Paste a repo. AI fixes the bugs. You play a short game to understand each fix before it unlocks.</p>
        <form onSubmit={start} className="mt-2 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="repo">GitHub repository URL</label>
          <input id="repo" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" required autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-white/25 bg-[#1b2670]/70 px-4 py-3 font-mono text-sm text-[#f7f3e8] placeholder:text-[#f7f3e8]/45 outline-none focus:border-accent" />
          <button type="submit" disabled={busy || !url.trim()}
            className="btn3d inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-display text-sm font-bold text-[#2a1a00] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Starting</> : "Scan repo"}
          </button>
        </form>
        {err && <p role="alert" className="text-sm text-sev-high">{err}</p>}
        <Link href="/scan/demo" className="text-sm text-sev-low hover:underline">No repo handy? Try the demo</Link>
      </section>

      <section aria-label="How it works" className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, color, title, text }) => (
          <div key={title} className="slab flex flex-col gap-2 rounded-md border border-line bg-panel p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-md" style={{ background: `${color}26`, color }}><Icon size={22} /></span>
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <p className="text-sm leading-relaxed text-[#f7f3e8]/75">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
