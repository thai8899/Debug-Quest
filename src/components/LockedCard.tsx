import Link from "next/link";
import { Lock, LockOpen } from "lucide-react";
import type { PublicBug } from "@/lib/contract";

const SEV = { high: "text-sev-high border-sev-high", medium: "text-sev-medium border-sev-medium", low: "text-sev-low border-sev-low" };

export default function LockedCard({ bug }: { bug: PublicBug }) {
  const open = !bug.locked;
  return (
    <div className={`chunky rounded-2xl border-2 bg-panel p-4 flex flex-col gap-3 ${open ? "border-accent" : "border-line"}`}>
      <div className="flex items-center justify-between">
        {open ? <LockOpen className="text-accent" size={28} /> : <Lock className="text-sev-medium" size={28} />}
        <span className={`rounded-full border px-2 py-0.5 text-xs uppercase ${SEV[bug.severity]}`}>{bug.severity}</span>
      </div>
      <div>
        <div className="font-mono text-sm break-all">{bug.file}</div>
        <div className="text-xs opacity-60">lines {bug.lineStart}-{bug.lineEnd}</div>
      </div>
      <span className="self-start rounded bg-line px-2 py-1 text-xs">{bug.category}</span>
      <Link href={`/quiz/${bug.id}`}
        className={`chunky mt-auto rounded-xl px-3 py-2 text-center font-pixel text-[10px] leading-4 ${open ? "bg-accent/15 text-accent" : "bg-accent text-black hover:brightness-110"}`}>
        {open ? "VIEW FIX" : "PLAY TO UNLOCK"}
      </Link>
    </div>
  );
}
