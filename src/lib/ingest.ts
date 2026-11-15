import type { Bug, Scan, Severity } from "./contract";
import type { Bug as RawBug, Scan as RawScan, TestResult } from "./types";
import { getScan } from "./store";
import { getBugsForScan, redactBug, saveBugs } from "./data";
import { prepareLevels } from "./game";

// Bridge between Punarva's scan store (her Bug/Scan shapes) and the unlock game (the team contract).
// Called lazily from GET /api/scan/[id]; safe to call on every poll.

const sevOf = (type: string): Severity =>
  /security|inject|secret|auth|leak|crash|null|undefined|async|await|race|promise/i.test(type) ? "high" : /style|lint|format|naming/i.test(type) ? "low" : "medium";

async function fileAt(owner: string, repo: string, path: string, ref?: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}${ref ? `?ref=${ref}` : ""}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.raw+json" },
    });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

// Give the level real surrounding code and real line numbers by finding the snippet in the file at scan time.
export async function toContractBug(scan: RawScan, b: RawBug): Promise<Bug> {
  const base = {
    id: b.id, scanId: scan.id, file: b.file, category: b.bugType, severity: sevOf(b.bugType),
    explainSimple: `${b.whatWasWrong} ${b.whyFixWorks}`.trim(), explainDeep: `${b.whatWasWrong}\n\n${b.whyFixWorks}`,
    sources: [] as string[], locked: true,
  };
  const content = await fileAt(scan.owner, scan.repo, b.file, scan.commitSha);
  const at = content ? content.indexOf(b.original) : -1;
  if (!content || at < 0) {
    return { ...base, lineStart: 1, lineEnd: b.original.split("\n").length, originalCode: b.original, fixedCode: b.replacement, lineRelative: true };
  }
  const fixedFile = content.slice(0, at) + b.replacement + content.slice(at + b.original.length);
  const line0 = content.slice(0, at).split("\n").length - 1;
  const span = b.original.split("\n").length;
  const from = Math.max(0, line0 - 3);
  const to = Math.min(content.split("\n").length, line0 + span + 3);
  const delta = b.replacement.split("\n").length - span;
  return {
    ...base, lineStart: from + 1, lineEnd: to,
    originalCode: content.split("\n").slice(from, to).join("\n"),
    fixedCode: fixedFile.split("\n").slice(from, to + delta).join("\n"),
  };
}

const inflight = new Map<string, Promise<void>>();
function ingestOnce(scan: RawScan) {
  let p = inflight.get(scan.id);
  if (!p) {
    p = (async () => {
      if ((await getBugsForScan(scan.id)).length) return;
      const bugs = await Promise.all(scan.bugs.filter((b) => b.applied).map((b) => toContractBug(scan, b)));
      if (!bugs.length) return;
      await saveBugs(bugs);
      void prepareLevels(bugs); // build the boards in the background so Play opens fast
    })().catch((e) => { inflight.delete(scan.id); console.warn("[ingest] failed:", e instanceof Error ? e.message : e); });
    inflight.set(scan.id, p);
  }
  return p;
}

const counts = (t?: TestResult) => (t?.ran ? { pass: t.passing ?? 0, fail: t.failing ?? 0 } : undefined);

// A real scan in the contract shape, with locked bugs redacted.
export async function loadGameScan(id: string): Promise<Scan | null> {
  const raw = await getScan(id);
  if (!raw) return null;
  const scan: Scan = {
    id: raw.id, repoUrl: raw.repoUrl, status: raw.status, step: raw.step, error: raw.error,
    fixBranch: raw.branch, prUrl: raw.prUrl, testsBefore: counts(raw.testsBefore), testsAfter: counts(raw.testsAfter), bugs: [],
  };
  if (raw.status !== "done") return scan;
  await ingestOnce(raw);
  scan.bugs = (await getBugsForScan(raw.id)).sort((a, b) => a.id.localeCompare(b.id)).map(redactBug);
  return scan;
}
