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

type QuizData = { bugId: string; scanId: string; file: string; category: string; unlocked: boolean; bug?: Bug; passScore: number; questions: PublicQuestion[] };
type Review = { prompt: string; correct: boolean; whyCorrect: string };
type Result =
  | { passed: true; xpEarned: number; correct: number; total: number; bug: Bug; review: Review[] }
  | { passed: false; correct: number; total: number; hint: string };

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
      if (!r.ok) return setError(j.error ?? "Could not load quiz");
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
    if (next.length === quiz.questions.length) { setAnswers(next); submit(next); }
    else { setAnswers(next); setStep(step + 1); }
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
      if (n >= 1 && n <= q.options.length) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function retry() { setAnswers([]); setStep(0); setResult(null); setHints({}); startedAt.current = Date.now(); }

  const back = <Link href={`/scan/${quiz?.scanId ?? "demo"}`} className="mb-4 inline-flex items-center gap-1 text-sm opacity-70 hover:opacity-100"><ArrowLeft size={14} /> Back to bugs</Link>;
  if (error)
    return (
      <Page>
        {back}
        <p className="text-sev-high">{error}</p>
        <button onClick={() => location.reload()} className="mt-4 rounded-lg bg-accent px-4 py-2 font-pixel text-[10px] text-black">RETRY</button>
      </Page>
    );
  if (!quiz)
    return (
      <Page>
        <p className="font-pixel text-xs">WRITING YOUR QUIZ...</p>
        <p className="mt-3 text-sm opacity-60">Gemini is building questions from your own code. This takes a few seconds.</p>
      </Page>
    );

  if (quiz.unlocked && quiz.bug) return <Page>{back}<UnlockReveal bug={quiz.bug} xp={0} /></Page>;

  if (result?.passed) {
    return (
      <Page>
        <UnlockReveal bug={result.bug} xp={result.xpEarned} />
        <div className="mt-6 rounded-xl border border-line bg-panel p-4 text-sm">
          <div className="mb-2 font-pixel text-[10px] text-accent">HOW YOU DID · {result.correct}/{result.total}</div>
          <ul className="space-y-2">{result.review.map((r, i) => <li key={i}>{r.correct ? "✅" : "❌"} {r.whyCorrect}</li>)}</ul>
        </div>
        {back}
      </Page>
    );
  }

  if (result && !result.passed) {
    return (
      <Page>
        {back}
        <div className="rounded-xl border-2 border-sev-high bg-panel p-6 text-center">
          <div className="font-pixel text-sm text-sev-high">NOT QUITE · {result.correct}/{result.total}</div>
          <p className="mt-4 flex items-start justify-center gap-2 text-sm"><Lightbulb size={16} className="mt-0.5 text-sev-medium" /> {result.hint}</p>
          <button onClick={retry} className="mt-6 rounded-lg bg-accent px-5 py-3 font-pixel text-[10px] text-black hover:brightness-110">TRY AGAIN</button>
        </div>
      </Page>
    );
  }

  const q = quiz.questions[step];
  return (
    <Page>
      {back}
      <div className="mb-1 flex justify-between text-xs opacity-70"><span>{quiz.file}</span><span>Question {step + 1} of {quiz.questions.length}</span></div>
      <div className="mb-6 h-2 rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(step / quiz.questions.length) * 100}%` }} /></div>
      <div className="mb-4 flex items-center gap-3">
        <Mascot size={44} mood={busy ? "run" : "idle"} />
        <h2 className="text-lg font-semibold">{q.prompt}</h2>
      </div>

      {q.type === "spot-the-line" ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-[#10102a] font-mono text-sm">
          {q.options.map((line, i) => (
            <button key={i} disabled={busy} onClick={() => pick(i)}
              className="flex w-full min-w-max gap-4 px-3 py-1.5 text-left hover:bg-accent/20">
              <span className="w-5 select-none text-right opacity-40">{i + 1}</span>
              <span className="whitespace-pre">{line || " "}</span>
            </button>
          ))}
        </div>
      ) : q.type === "pick-the-fix" ? (
        <FixBuilder key={step} code={q.code} options={q.options} disabled={busy} onSubmit={pick} />
      ) : (
        <>
          {q.code && <CodeBlock code={q.code} />}
          <div className="mt-4 grid gap-3">
            {q.options.map((o, i) => (
              <button key={i} disabled={busy} onClick={() => pick(i)}
                className="rounded-xl border-2 border-line bg-panel p-4 text-left font-mono text-sm hover:border-accent active:scale-[0.99]">{o}</button>
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        {hints[step] ? (
          <p className="flex items-start gap-2 text-sm text-sev-medium"><Lightbulb size={16} className="mt-0.5" /> {hints[step]}</p>
        ) : (
          <button onClick={showHint} className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100"><Lightbulb size={16} /> Show hint</button>
        )}
      </div>
      {busy && <p className="mt-4 font-pixel text-[10px]">CHECKING...</p>}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-6 font-pixel text-lg text-accent">DEBUG QUEST</h1>
      {children}
    </main>
  );
}
