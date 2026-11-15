import Link from "next/link";
import { Lock, LockOpen } from "lucide-react";
import type { PublicBug } from "@/lib/contract";
import type { PlaytestFinding } from "@/lib/types";

const SEV = { high: "bg-sev-high text-sev-high", medium: "bg-sev-medium text-sev-medium", low: "bg-sev-low text-sev-low" };

export default function LockedCard({
  bug,
  playtestFindings = [],
}: {
  bug: PublicBug;
  playtestFindings?: PlaytestFinding[];
}) {
  const open = !bug.locked;
  const idx = bug.findingIndex;
  const showPlaytester =
    typeof idx === "number" && playtestFindings[idx] != null;

  return (
    <div className="slab relative flex flex-col gap-3 overflow-hidden rounded-md border border-line bg-panel p-4 pl-5 transition-transform hover:-translate-y-1">
      <span className={`absolute inset-y-0 left-0 w-1 ${SEV[bug.severity].split(" ")[0]}`} />
      <div className="flex items-center justify-between gap-2">
        {open ? <LockOpen className="text-ok" size={20} /> : <Lock className="text-accent" size={20} />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showPlaytester && (
            <a
              href={`#finding-${idx}`}
              className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/20"
            >
              🤖 Found by Playtester
            </a>
          )}
          <span className={`text-xs font-semibold ${SEV[bug.severity].split(" ")[1]}`}>{bug.severity} severity</span>
        </div>
      </div>
      <div>
        <div className="break-all font-mono text-sm">{bug.file}</div>
        <div className="text-xs text-[#ede8dc]/50">{bug.lineRelative ? `${bug.lineEnd} line snippet` : `lines ${bug.lineStart} to ${bug.lineEnd}`}</div>
      </div>
      <span className="w-fit rounded-sm bg-white/5 px-2 py-0.5 font-mono text-xs text-[#ede8dc]/80">{bug.category}</span>
      <Link href={`/play/${bug.id}`}
        className={`mt-1 rounded-sm px-3 py-2 text-center font-display text-sm font-semibold ${open ? "border border-ok/60 text-ok hover:bg-ok/10" : "bg-accent text-[#1a1203] hover:brightness-110"}`}>
        {open ? "View fix" : "Unlock fix"}
      </Link>
    </div>
  );
}
