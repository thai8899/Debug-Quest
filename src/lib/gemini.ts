import { GoogleGenAI, Type } from "@google/genai";
import type { PlaytestFinding, TestResult } from "./types";

export type RawBug = {
  file: string;
  bugType: string;
  title: string;
  original: string;
  replacement: string;
  whatWasWrong: string;
  whyFixWorks: string;
  findingIndex?: number | null;
};

const PROMPT = `You are a senior engineer reviewing a repository for real bugs.
Find genuine defects (logic errors, off-by-one, null/undefined handling, wrong operators, bad async handling, security issues).
Ignore style nits. If tests are failing, prioritise the bugs that cause those failures.
Check especially for: non-null assertions (!) on optional values, files/handles/connections that are opened but never closed, un-awaited promises, off-by-one ranges, and == comparisons between different types.
For each bug return the smallest possible patch:
- "original": an EXACT, verbatim snippet from the file (copy whitespace precisely) that appears exactly once in that file.
- "replacement": the corrected snippet.
- "bugType": a short category such as off-by-one, null-handling, wrong-operator, async, security, logic.
- "whatWasWrong" and "whyFixWorks": plain English for a student, 1-2 sentences each.
- "findingIndex": if a QA finding below is explained by this bug, the 0-based index of that finding; otherwise null.
Return at most 5 bugs. Return an empty list if the code is fine.`;

function formatFailingTests(tests: TestResult): string {
  if (!tests.ran) return "No tests detected.";
  const lines = [
    `Test command: ${tests.command}`,
    `Summary: ${tests.failing ?? "?"} failing, ${tests.passing ?? "?"} passing`,
  ];
  const failures = tests.failures?.length
    ? tests.failures
    : [];
  if (failures.length) {
    lines.push("These tests currently fail:");
    for (const f of failures) {
      lines.push(`- ${f.name}${f.message ? `: ${f.message}` : ""}`);
    }
    lines.push(
      "Every failing test should be explained by a bug you report, unless the test itself is wrong.",
    );
  } else if (tests.output) {
    lines.push(`Output tail:\n${tests.output}`);
  }
  return lines.join("\n");
}

function formatFindings(findings: PlaytestFinding[]): string {
  if (!findings.length) return "";
  const lines = [
    "A QA agent used the live app and reported these problems. Treat them as clues, not facts:",
    "some may be the agent's own mistakes (e.g. it single-clicked where a double-click was needed).",
    "Only report a bug if you can point to code that causes it.",
    "",
    "Findings:",
  ];
  findings.forEach((f, i) => {
    lines.push(
      `[${i}] page=${f.page} | action=${f.action} | expected=${f.expected} | actual=${f.actual}`,
    );
  });
  return lines.join("\n");
}

export async function findBugs(
  files: { path: string; content: string }[],
  tests: TestResult,
  findings: PlaytestFinding[] = [],
): Promise<RawBug[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
  const code = files.map((f) => `=== FILE: ${f.path} ===\n${f.content}`).join("\n\n");
  const testInfo = formatFailingTests(tests);
  const qaInfo = formatFindings(findings);
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    contents: `${PROMPT}\n\n${testInfo}\n\n${qaInfo ? qaInfo + "\n\n" : ""}${code}`,
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
                findingIndex: { type: Type.NUMBER, nullable: true },
              },
              required: ["file", "bugType", "title", "original", "replacement", "whatWasWrong", "whyFixWorks", "findingIndex"],
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
