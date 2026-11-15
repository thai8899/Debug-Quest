// Shapes from the team contract (plan: "The contract" + "Database design").
export type Severity = "high" | "medium" | "low";

export type Bug = {
  id: string;
  scanId: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  category: string;
  severity: Severity;
  originalCode: string;
  fixedCode: string;
  explainSimple: string;
  explainDeep: string;
  sources: string[];
  locked: boolean;
  // True when line numbers count from 1 inside the snippet (the real file could not be fetched).
  lineRelative?: boolean;
  /** Index into scan.playtest.findings this bug explains, or null/undefined if unrelated. */
  findingIndex?: number | null;
};

// What the API returns while a bug is locked: no fix, no explanations.
export type PublicBug = Omit<Bug, "fixedCode" | "explainSimple" | "explainDeep" | "sources"> &
  Partial<Pick<Bug, "fixedCode" | "explainSimple" | "explainDeep" | "sources">>;

export type TestCounts = { pass: number; fail: number };

export type Scan = {
  id: string;
  repoUrl: string;
  status: "running" | "done" | "error";
  fixBranch?: string;
  prUrl?: string;
  testsBefore?: TestCounts;
  testsAfter?: TestCounts;
  bugs: PublicBug[];
  step?: string;
  error?: string;
  playtest?: import("./types").ScanPlaytest;
};

export type QuestionType = "spot-the-line" | "predict" | "pick-the-fix";

export type Question = {
  type: QuestionType;
  prompt: string;
  code: string;
  options: string[];
  answerIndex: number;
  hint: string;
  whyCorrect: string;
};

export type Quiz = { bugId: string; questions: Question[]; passScore: number };

// Sent to the browser: no answers, no hints (hints are fetched on demand), no explanations.
export type PublicQuestion = Pick<Question, "type" | "prompt" | "code" | "options">;
