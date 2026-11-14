export type Bug = {
  id: string;
  file: string;
  bugType: string;
  title: string;
  original: string;
  replacement: string;
  whatWasWrong: string;
  whyFixWorks: string;
  applied: boolean;
};

export type TestResult = {
  command: string;
  ran: boolean;
  failing: number | null;
  passing: number | null;
  exitCode: number | null;
  output: string;
};

export type Scan = {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  status: "running" | "done" | "error";
  step: string;
  createdAt: string;
  bugs: Bug[];
  testsBefore?: TestResult;
  testsAfter?: TestResult;
  branch?: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  // Fix details stay hidden in the UI until the unlock game is passed.
  locked: boolean;
};
