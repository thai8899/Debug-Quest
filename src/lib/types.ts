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
  /** Index into scan.playtest.findings this bug explains, or null/undefined if unrelated. */
  findingIndex?: number | null;
};

export type PlaytestFinding = {
  page: string;
  action: string;
  expected: string;
  actual: string;
};

export type ScanPlaytestEvent = {
  at: string;
  type: string;
  run_id?: string;
  streaming_url?: string;
  purpose?: string;
  status?: string;
  result?: unknown;
  error?: unknown;
};

export type PlaytestStepShot = {
  stepId: string;
  purpose: string;
  /** data:image/... URI or absolute URL */
  imageSrc: string;
};

export type ScanPlaytest = {
  status: "running" | "done" | "partial" | "skipped" | "error";
  events: ScanPlaytestEvent[];
  findings: PlaytestFinding[];
  notes?: string;
  reason?: string;
  streamingUrl?: string;
  runId?: string;
  /** Step screenshots for replay (real runs only; omitted in mock). */
  steps?: PlaytestStepShot[];
};

export type TestFailure = {
  name: string;
  message: string;
};

export type TestResult = {
  command: string;
  ran: boolean;
  failing: number | null;
  passing: number | null;
  exitCode: number | null;
  output: string;
  failures?: TestFailure[];
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
  /** True when DRY_RUN=true — local fixes only, no push/PR. */
  dryRun?: boolean;
  error?: string;
  /** HEAD commit SHA at scan time; used to skip Gemini on rescans of the same commit. */
  commitSha?: string;
  /**
   * Gemini cache key fragment for playtest context: "none" when no findings were used,
   * otherwise a hash of this scan's playtest findings.
   */
  playtestFindingsKey?: string;
  /** Optional live app URL for TinyFish playtesting. */
  liveUrl?: string;
  playtest?: ScanPlaytest;
  // Fix details stay hidden in the UI until the unlock game is passed.
  locked: boolean;
};
