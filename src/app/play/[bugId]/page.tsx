"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lightbulb, Play, RotateCcw, Star } from "lucide-react";
import type { Bug } from "@/lib/contract";
import type { GuardDef, GuardId, PublicLevel, RunResult } from "@/lib/levelTypes";
import Board, { type BoardState } from "@/components/Board";
import GuardIcon, { GUARD_COLOR } from "@/components/GuardIcon";
import UnlockReveal from "@/components/UnlockReveal";
import Mascot from "@/components/Mascot";
import SpeechBubble from "@/components/SpeechBubble";
import Logo from "@/components/Logo";

type GameData = PublicLevel & { bugId: string; scanId: string; file: string; category: string; unlocked: boolean; bug?: Bug };
type Win = Extract<RunResult, { passed: true }> & { bug: Bug };
type Fail = Extract<RunResult, { passed: false }>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const IDLE: BoardState = { cell: 0, caught: [], crashed: null, done: false };
const btn = "btn3d inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-display text-sm font-bold text-[#2a1a00] disabled:cursor-not-allowed disabled:opacity-40";

export default function PlayPage() {
  const { bugId } = useParams<{ bugId: string }>();
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState("");
  const [placements, setPlacements] = useState<Record<string, GuardId>>({});
  const [selected, setSelected] = useState<GuardId | null>(null);
  const [rs, setRs] = useState<BoardState>(IDLE);
  const [phase, setPhase] = useState<"setup" | "running" | "failed" | "won">("setup");
  const [say, setSay] = useState("");
  const [fail, setFail] = useState<Fail | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  const startedAt = useRef(Date.now());
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    fetch(`/api/game/${bugId}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "Could not load the level.");
      setData(j);
      setSay(`Bug-bot is loose in ${j.file}. Put guards where the code can break.`);
    }).catch(() => setError("Could not load the level."));
  }, [bugId]);

  const cost = (id: GuardId) => data!.guards.find((g) => g.id === id)!.cost;
  const spent = data ? Object.values(placements).reduce((n, g) => n + cost(g), 0) : 0;
  const left = data ? data.budget - spent : 0;

  useEffect(() => {
    if (!data || phase !== "setup") return;
    const onKey = (e: KeyboardEvent) => { const g = data.guards[Number(e.key) - 1]; if (g) setSelected(g.id); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [data, phase]);

  function onSocket(id: string) {
    if (!data || phase !== "setup") return;
    const line = data.stations.find((s) => s.id === id)!.line;
    const cur = placements[id];
    if (cur && (!selected || selected === cur)) {
      const next = { ...placements }; delete next[id]; setPlacements(next); return setSay(`Guard removed from line ${line}.`);
    }
    if (!selected) return setSay("Pick a guard from the toolbox first.");
    if (left + (cur ? cost(cur) : 0) < cost(selected)) return setSay("Not enough budget. Remove a guard or pick a cheaper one.");
    setPlacements({ ...placements, [id]: selected });
    setSay(`${data.guards.find((g) => g.id === selected)!.name} attached to line ${line}.`);
  }

  async function run() {
    if (!data || phase !== "setup") return;
    setPhase("running"); setFail(null); setRs(IDLE); setSay("Running the test. Watch the bug-bot.");
    const total = data.stations.length + 2;
    let res: RunResult & { bug?: Bug };
    try {
      const r = await fetch(`/api/game/${bugId}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placements, secondsToSolve: Math.round((Date.now() - startedAt.current) / 1000) }),
      });
      if (!r.ok) throw new Error();
      res = await r.json();
    } catch { setPhase("setup"); return setSay("The test could not run. Try again."); }

    await sleep(500);
    for (let i = 0; i < res.trace.length; i++) {
      if (!alive.current) return;
      const step = res.trace[i];
      setRs((s) => ({ ...s, cell: i + 1 }));
      await sleep(650);
      const line = data.stations.find((s) => s.id === step.stationId)!.line;
      if (step.result === "caught") { setRs((s) => ({ ...s, caught: [...s.caught, step.stationId] })); setSay(`Guard held on line ${line}.`); await sleep(500); }
      if (step.result === "crash") { setRs((s) => ({ ...s, crashed: step.stationId })); setSay(`Crash on line ${line}.`); await sleep(1000); }
    }
    if (!alive.current) return;
    if (res.passed) {
      setRs((s) => ({ ...s, cell: total - 1 })); await sleep(750);
      setRs((s) => ({ ...s, done: true })); setSay("Contained. The bug can't get through."); await sleep(1100);
      if (alive.current) { setWin(res as Win); setPhase("won"); }
    } else { setFail(res); setPhase("failed"); }
  }

  function retry() { setRs(IDLE); setPhase("setup"); setSay("Adjust your guards and run it again."); }

  if (error) return <Shell><div role="alert" className="rounded-md border border-sev-high/50 bg-sev-high/10 p-4">{error}</div></Shell>;
  if (!data) return <Shell><SpeechBubble>Building your level from the code. A few seconds.</SpeechBubble></Shell>;

  const reveal = win ? { bug: win.bug, xp: win.xpEarned } : data.unlocked && data.bug ? { bug: data.bug, xp: 0 } : null;
  const back = <Link href={`/scan/${data.scanId}`} className="inline-flex w-fit items-center gap-2 text-sm text-[#ede8dc]/70 hover:text-accent"><ArrowLeft size={16} /> Back to results</Link>;

  if (reveal) return (
    <Shell>
      {back}
      {win && (
        <div className="flex flex-col items-center gap-2 py-2" aria-label={`${win.stars} of 3 stars`}>
          <div className="flex gap-2">{[1, 2, 3].map((n) => <Star key={n} size={30} className={n <= win.stars ? "fill-accent text-accent" : "text-[#ede8dc]/25"} />)}</div>
          <div className="font-mono text-xs text-[#ede8dc]/55">{win.stars === 3 ? "Clean run, no mistakes, no wasted guards" : "Fewer mistakes and no wasted guards earn more stars"}</div>
        </div>
      )}
      <UnlockReveal bug={reveal.bug} xp={reveal.xp} />
      {win && (
        <div className="rounded-md border border-line bg-panel p-4">
          <h3 className="mb-2 font-display text-lg font-semibold">Why your guard worked</h3>
          <ul className="flex flex-col gap-2 text-[#ede8dc]/85">{win.review.map((r) => <li key={r.line}><span className="font-mono text-accent">line {r.line}</span> {r.why}</li>)}</ul>
        </div>
      )}
    </Shell>
  );

  return (
    <Shell>
      {back}
      <div className="flex items-start gap-3">
        <Mascot size={52} mood={phase === "failed" ? "sad" : rs.done ? "happy" : phase === "running" ? "run" : "idle"} />
        <div className="min-w-0 flex-1"><SpeechBubble>{say}</SpeechBubble></div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="flex min-w-0 flex-col gap-4">
          <div className="ticks rounded-md border border-line bg-panel p-4">
            <div className="mb-1 font-display text-xs font-semibold text-accent">Your goal</div>
            <p className="text-sm leading-relaxed text-[#ede8dc]/90">Stop the bug-bot from crashing <span className="font-mono">{data.file}</span>. Read the code, find where it breaks, and attach the right guard to that line.</p>
            <p className="mt-2 border-t border-line pt-2 text-sm text-[#ede8dc]/70"><span className="text-sev-high">Symptom:</span> {data.symptom}</p>
          </div>

          <div className="ticks rounded-md border border-line bg-panel p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="font-display text-xs font-semibold text-accent">Guards</span>
              <span className={`font-mono text-sm ${left < 20 ? "text-sev-medium" : "text-[#ede8dc]"}`}>${left} <span className="text-[#ede8dc]/45">of ${data.budget}</span></span>
            </div>
            <div role="radiogroup" aria-label="Guard tools" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {data.guards.map((g: GuardDef, i) => {
                const on = selected === g.id;
                return (
                  <button key={g.id} role="radio" aria-checked={on} disabled={phase !== "setup"} onClick={() => setSelected(on ? null : g.id)}
                    style={{ ["--c" as string]: GUARD_COLOR[g.id], borderColor: GUARD_COLOR[g.id], background: on ? `linear-gradient(180deg, ${GUARD_COLOR[g.id]}55, ${GUARD_COLOR[g.id]}22)` : `linear-gradient(180deg, ${GUARD_COLOR[g.id]}26, ${GUARD_COLOR[g.id]}0f)` }}
                    className="keycap flex shrink-0 items-center gap-2 rounded-md border p-2 text-left hover:brightness-125 disabled:opacity-60">
                    <GuardIcon id={g.id} />
                    <span className="whitespace-nowrap text-sm font-medium lg:flex-1">{g.name}</span>
                    <span className="font-mono text-xs text-[#ede8dc]/55">${g.cost}</span>
                    <kbd className="hidden rounded-sm border border-line px-1.5 font-mono text-[10px] text-[#ede8dc]/45 lg:inline">{i + 1}</kbd>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 min-h-[2.5rem] text-xs leading-snug text-[#ede8dc]/65">
              {selected ? data.guards.find((g) => g.id === selected)!.desc : "Pick a guard, then tap the hex socket on a line of code to attach it."}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <Board stations={data.stations} placements={placements} selected={selected} state={rs} onSocket={onSocket} />

          {phase === "failed" && fail && (
            <div role="alert" className="rounded-md border border-sev-high/60 bg-sev-high/10 p-4">
              <div className="font-display text-lg font-semibold">The bug got through</div>
              <p className="mt-1 text-[#ede8dc]/90">{fail.crash}</p>
              {fail.hint && <p className="mt-2 flex gap-2 text-sm text-sev-medium"><Lightbulb size={16} className="mt-0.5 shrink-0" /> {fail.hint}</p>}
              <button onClick={retry} className={`${btn} mt-3`}><RotateCcw size={16} /> Adjust and run again</button>
            </div>
          )}

          {phase !== "failed" && (
            <div className="flex items-center gap-3">
              <button onClick={run} disabled={phase !== "setup" || Object.keys(placements).length === 0} className={btn}>
                <Play size={16} /> {phase === "running" ? "Running" : "Run test"}
              </button>
              <span className="text-sm text-[#ede8dc]/55">{Object.keys(placements).length === 0 ? "Attach at least one guard to run the test." : `${Object.keys(placements).length} guard${Object.keys(placements).length > 1 ? "s" : ""} placed`}</span>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6"><Logo />{children}</main>;
}
