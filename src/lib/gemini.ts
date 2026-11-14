import { GoogleGenAI, Type } from "@google/genai";
import type { TestResult } from "./types";

export type RawBug = {
  file: string;
  bugType: string;
  title: string;
  original: string;
  replacement: string;
  whatWasWrong: string;
  whyFixWorks: string;
};

const PROMPT = `You are a senior engineer reviewing a repository for real bugs.
Find genuine defects (logic errors, off-by-one, null/undefined handling, wrong operators, bad async handling, security issues).
Ignore style nits. If tests are failing, prioritise the bugs that cause those failures.
For each bug return the smallest possible patch:
- "original": an EXACT, verbatim snippet from the file (copy whitespace precisely) that appears exactly once in that file.
- "replacement": the corrected snippet.
- "bugType": a short category such as off-by-one, null-handling, wrong-operator, async, security, logic.
- "whatWasWrong" and "whyFixWorks": plain English for a student, 1-2 sentences each.
Return at most 5 bugs. Return an empty list if the code is fine.`;

export async function findBugs(files: { path: string; content: string }[], tests: TestResult): Promise<RawBug[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const code = files.map((f) => `=== FILE: ${f.path} ===\n${f.content}`).join("\n\n");
  const testInfo = tests.ran ? `Test command: ${tests.command}\nFailing: ${tests.failing}\nOutput tail:\n${tests.output}` : "No tests detected.";
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    contents: `${PROMPT}\n\n${testInfo}\n\n${code}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bugs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                file: { type: Type.STRING },
                bugType: { type: Type.STRING },
                title: { type: Type.STRING },
                original: { type: Type.STRING },
                replacement: { type: Type.STRING },
                whatWasWrong: { type: Type.STRING },
                whyFixWorks: { type: Type.STRING },
              },
              required: ["file", "bugType", "title", "original", "replacement", "whatWasWrong", "whyFixWorks"],
            },
          },
        },
        required: ["bugs"],
      },
    },
  });
  const parsed = JSON.parse(res.text ?? "{}");
  return Array.isArray(parsed.bugs) ? parsed.bugs : [];
}
