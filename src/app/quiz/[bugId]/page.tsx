"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import type { Bug, PublicQuestion } from "@/lib/contract";
import CodeBlock from "@/components/CodeBlock";
import UnlockReveal from "@/components/UnlockReveal";
import FixBuilder from "@/components/FixBuilder";
import Mascot from "@/components/Mascot";
import SpeechBubble from "@/components/SpeechBubble";
import Logo from "@/components/Logo";

type QuizData = { bugId: string; scanId: string; file: string; category: string; unlocked: boolean; bug?: Bug; passScore: number; questions: PublicQuestion[] };
type Review = { prompt: string; correct: boolean; whyCorrect: string };
type Result =
  | { passed: true; xpEarned: number; correct: number; total: number; bug: Bug; review: Review[] }
  | { passed: false; correct: number; total: number; hint: string };

const SAYS = ["Read the code before you answer.", "One down. Keep reading closely.", "Last one. Build the fix."];
const btn = "rounded-sm bg-accent px-5 py-3 font-display text-sm font-semibold text-[#1a1203] hover:brightness-110";

export default function QuizPage() {
  const { bugId } = useParams<{ bugId: string }>();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [hints, setHints] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    fetch(`/api/quiz/${bugId}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "Could not load the quiz.");
      setQuiz(j);
    });
  }, [bugId]);

  async function submit(final: number[]) {
    setBusy(true);
    const r = await fetch(`/api/quiz/${bugId}/answer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: final, secondsToSolve: Math.round((Date.now() - startedAt.current) / 1000) }),
    });
    setResult(await r.json());
    setBusy(false);
  }

  function pick(i: number) {
    if (!quiz || busy) return;
    const next = [...answers, i];
    setAnswers(next);
    if (next.length === quiz.questions.length) submit(next);
    else setStep(step + 1);
  }

  async function showHint() {
    const r = await fetch(`/api/quiz/${bugId}/hint`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionIndex: step }) });
    const j = await r.json();
    if (j.hint) setHints({ ...hints, [step]: j.hint });
  }

  useEffect(() => {
    if (!quiz || result || quiz.unlocked) return;
    const q = quiz.questions[step];
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= q.options.length && q.type !== "pick-the-fix") pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function retry() { setAnswers([]); setStep(0); setResult(null); setHints({}); startedAt.current = Date.now(); }

  const back = <Link href={`/scan/${quiz?.scanId ?? "demo"}`} className="mb-5 inline-flex items-center gap-1 text-sm text-[#ede8dc]/60 hover:text-[#ede8dc]"><ArrowLeft size={14} /> Back to bugs</Link>;

  if (error)
    return (
      <Page>
        {back}
        <p className="text-sev-high">{error}</p>
        <button onClick={() => location.reload()} className={`${btn} mt-4`}>Try again</button>
      </Page>
    );
  if (!quiz)
    return (
      <Page>
        <div className="flex items-center gap-4"><Mascot size={56} mood="run" /><SpeechBubble>Writing your challenge from your own code. A few seconds.</SpeechBubble></div>
      </Page>
    );

  if (quiz.unlocked && quiz.bug) return <Page>{back}<UnlockReveal bug={quiz.bug} xp={0} /></Page>;

  if (result?.passed) {
    return (
      <Page>
        {back}
        <UnlockReveal bug={result.bug} xp={result.xpEarned} />
        <div className="mt-6 rounded-md border border-line bg-panel p-4 text-sm">
          <div className="mb-2 font-display text-base font-semibold">Your answers: {result.correct} of {result.total} correct</div>
          <ul className="space-y-2">{result.review.map((r, i) => <li key={i} className={r.correct ? "text-ok" : "text-sev-high"}><span className="text-[#ede8dc]/90">{r.correct ? "Correct. " : "Missed. "}{r.whyCorrect}</span></li>)}</ul>
        </div>
      </Page>
    );
  }

  if (result && !result.passed) {
    return (
      <Page>
        {back}
        <div className="rounded-md border border-sev-high/50 bg-panel p-6">
          <div className="flex items-center gap-4">
            <Mascot size={64} mood="sad" />
            <div>
              <div className="font-display text-2xl font-bold">Not yet. {result.correct} of {result.total} correct.</div>
              <p className="mt-1 text-sm text-[#ede8dc]/60">You need {quiz.passScore} to unlock the fix.</p>
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" /> {result.hint}</p>
          <button onClick={retry} className={`${btn} mt-6`}>Try again</button>
        </div>
      </Page>
    );
  }

  const q = quiz.questions[step];
  return (
    <Page>
      {back}
      <div className="mb-5 flex items-center justify-between gap-4 text-sm text-[#ede8dc]/60">
        <span className="font-mono">{quiz.file} <span className="text-[#ede8dc]/30">/</span> {quiz.category}</span>
        <span>Question {step + 1} of {quiz.questions.length}</span>
      </div>
      <div className="mb-6 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${quiz.questions.length}, 1fr)` }} aria-hidden>
        {quiz.questions.map((_, i) => <div key={i} className={`h-1.5 rounded-full ${i < step ? "bg-accent" : i === step ? "bg-accent/50" : "bg-white/10"}`} />)}
      </div>

      <div className="mb-6 flex items-center gap-4">
        <Mascot size={56} mood={busy ? "run" : "idle"} />
        <SpeechBubble>{busy ? "Checking your answers." : hints[step] ?? SAYS[Math.min(step, SAYS.length - 1)]}</SpeechBubble>
      </div>

      <h2 className="mb-5 font-display text-2xl font-semibold leading-snug">{q.prompt}</h2>

      {q.type === "spot-the-line" ? (
        <div className="ticks overflow-x-auto rounded-md border border-line bg-[#0a1122] font-mono text-sm">
          {q.options.map((line, i) => (
            <button key={i} disabled={busy} onClick={() => pick(i)} className="flex w-full min-w-max items-center gap-4 px-3 py-1.5 text-left hover:bg-accent/15">
              <span className="w-5 select-none text-right text-[#ede8dc]/35">{i + 1}</span>
              <span className="whitespace-pre">{line || " "}</span>
            </button>
          ))}
        </div>
      ) : q.type === "pick-the-fix" ? (
        <FixBuilder key={step} code={q.code} options={q.options} disabled={busy} onSubmit={pick} />
      ) : (
        <>
          {q.code && <div className="ticks"><CodeBlock code={q.code} /></div>}
          <div className="mt-4 grid gap-2">
            {q.options.map((o, i) => (
              <button key={i} disabled={busy} onClick={() => pick(i)}
                className="flex items-center gap-4 rounded-md border border-line bg-panel px-4 py-3 text-left font-mono text-sm hover:border-accent/70 hover:bg-accent/5">
                <kbd className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-line bg-white/5 font-mono text-xs text-accent">{i + 1}</kbd>{o}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        {hints[step] ? null : (
          <button onClick={showHint} className="inline-flex items-center gap-2 text-sm text-[#ede8dc]/60 hover:text-[#ede8dc]"><Lightbulb size={16} /> Show hint</button>
        )}
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <Logo />
      {children}
    </main>
  );
}
