import { GoogleGenAI, Type } from "@google/genai";
import type { Bug, PublicQuestion, Question, Quiz } from "./contract";
import { CANNED_QUIZZES } from "./demo";
import { getQuiz, saveQuiz } from "./data";

const PROMPT = (level: number, weak: string[], bug: Bug) => `You are a patient tutor. A student's code had the bug below, and the fix
is locked until they show they understand it. Write 3 short questions.

Rules:
- Every question must be about THIS code, not general trivia.
- It must be impossible to answer without reading the code shown.
- Wrong options must be believable mistakes, not jokes.
- Plain words, short sentences. Reading level: ${level} (1 = beginner, 5 = experienced).
- Lean on these categories the student keeps missing: ${weak.join(", ") || "none yet"}

Question types, one of each, in this order:
1. spot-the-line: put ~8 lines of the original code in "code" and ask which line has the bug. "options" must be exactly the lines of "code", in order, and answerIndex the buggy line's position.
2. predict: "What happens when <specific input> goes in?" with 4 options.
3. pick-the-fix: 3 possible fixes, only one correct.

Bug: ${JSON.stringify({ file: bug.file, category: bug.category, originalCode: bug.originalCode, fixedCode: bug.fixedCode, explainSimple: bug.explainSimple })}

Return JSON: { "questions": [ { "type", "prompt", "code", "options", "answerIndex", "hint" (a nudge that does not give the answer away), "whyCorrect" (one sentence) } ], "passScore": 2 }`;

function valid(qs: unknown): qs is Question[] {
  if (!Array.isArray(qs) || qs.length !== 3) return false;
  const types = ["spot-the-line", "predict", "pick-the-fix"];
  return qs.every((x, i) =>
    x && x.type === types[i] && typeof x.prompt === "string" && typeof x.code === "string" &&
    Array.isArray(x.options) && x.options.length >= 2 && x.options.every((o: unknown) => typeof o === "string") &&
    Number.isInteger(x.answerIndex) && x.answerIndex >= 0 && x.answerIndex < x.options.length &&
    typeof x.hint === "string" && typeof x.whyCorrect === "string");
}

export async function makeQuiz(bug: Bug, level = 2, weakCategories: string[] = []): Promise<Quiz> {
  const canned = CANNED_QUIZZES[bug.id];
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("no key");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
    const str = { type: Type.STRING };
    const res = await Promise.race([
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
        contents: PROMPT(level, weakCategories, bug),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { type: str, prompt: str, code: str, options: { type: Type.ARRAY, items: str }, answerIndex: { type: Type.INTEGER }, hint: str, whyCorrect: str },
                  required: ["type", "prompt", "code", "options", "answerIndex", "hint", "whyCorrect"],
                },
              },
              passScore: { type: Type.INTEGER },
            },
            required: ["questions", "passScore"],
          },
        },
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 25_000)),
    ]);
    const parsed = JSON.parse(res.text ?? "{}");
    if (!valid(parsed.questions)) throw new Error("bad quiz shape");
    return { bugId: bug.id, questions: parsed.questions, passScore: 2 };
  } catch (e) {
    console.warn("[quiz] Gemini quiz failed, using", canned ? "canned quiz" : "no fallback:", e instanceof Error ? e.message.slice(0, 200) : e);
    if (canned) return { bugId: bug.id, questions: canned, passScore: 2 };
    throw e;
  }
}

export async function getOrMakeQuiz(bug: Bug): Promise<Quiz> {
  const existing = await getQuiz(bug.id);
  if (existing) return existing;
  const quiz = await makeQuiz(bug);
  await saveQuiz(quiz);
  return quiz;
}

export const toPublic = (q: Question): PublicQuestion => ({ type: q.type, prompt: q.prompt, code: q.code, options: q.options });

// Grading happens only here, on the server.
export function grade(quiz: Quiz, answers: unknown) {
  const arr = Array.isArray(answers) ? answers : [];
  const flags = quiz.questions.map((q, i) => arr[i] === q.answerIndex);
  const correct = flags.filter(Boolean).length;
  return { correct, passed: correct >= quiz.passScore, flags };
}

// Call this from the scan pipeline right after bugs are saved, so quizzes are ready when the user opens them.
export async function prepareQuizzes(bugs: Bug[]) {
  await Promise.allSettled(bugs.map((b) => getOrMakeQuiz(b)));
}
