import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import type { PlaytestFinding, Scan, ScanPlaytestEvent } from "./types";
import { listScans, saveScan } from "./store";
import { applyPatch, cloneRepo, parseRepoUrl, readSources, run, runTests } from "./repo";
import { findBugs, type RawBug } from "./gemini";
import {
  DEFAULT_GOAL,
  extractFindings,
  fetchRunStepShots,
  playtest,
  type PlaytestEvent,
} from "./playtester";
import * as gh from "./github";
import { sendScanAlert } from "./notify";

const PLAYTEST_CLIENT_TIMEOUT_MS = 200_000;

export async function startScan(repoUrl: string, liveUrl?: string): Promise<Scan> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const scan: Scan = {
    id: randomUUID().slice(0, 8),
    repoUrl, owner, repo,
    status: "running", step: "Queued", createdAt: new Date().toISOString(),
    bugs: [], locked: true,
    ...(liveUrl ? { liveUrl } : {}),
  };
  await saveScan(scan);
  // Fire and forget; the UI polls /api/scans/[id].
  void runPipeline(scan);
  return scan;
}

function toScanEvent(event: PlaytestEvent): ScanPlaytestEvent {
  return {
    at: new Date().toISOString(),
    type: event.type,
    ...(typeof event.run_id === "string" ? { run_id: event.run_id } : {}),
    ...(typeof event.streaming_url === "string" ? { streaming_url: event.streaming_url } : {}),
    ...(typeof event.purpose === "string" ? { purpose: event.purpose } : {}),
    ...(typeof event.status === "string" ? { status: event.status } : {}),
    ...(event.type === "COMPLETE"
      ? { result: event.result, error: event.error }
      : {}),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Cache key for whether/which playtest findings were fed to Gemini. */
function playtestFindingsKey(findings: PlaytestFinding[]): string {
  if (!findings.length) return "none";
  return createHash("sha256").update(JSON.stringify(findings)).digest("hex");
}

async function runPlaytestPhase(scan: Scan, liveUrl: string, commitSha: string) {
  scan.playtest = { status: "running", events: [], findings: [] };
  await saveScan(scan);

  let acceptEvents = true;

  const onEvent = (event: PlaytestEvent) => {
    if (!acceptEvents || !scan.playtest) return;
    scan.playtest.events.push(toScanEvent(event));
    if (event.type === "STARTED" && typeof event.run_id === "string") {
      scan.playtest.runId = event.run_id;
    }
    if (event.type === "STREAMING_URL" && typeof event.streaming_url === "string") {
      scan.playtest.streamingUrl = event.streaming_url;
      console.log("[playtest] STREAMING_URL", event.streaming_url);
    }
    if (event.type === "COMPLETE") {
      const { findings, notes } = extractFindings(event.result);
      scan.playtest.findings = findings;
      if (notes) scan.playtest.notes = notes;
    }
    void saveScan(scan);
  };

  try {
    const goal = process.env.PLAYTEST_GOAL || DEFAULT_GOAL;
    const playPromise = playtest(liveUrl, goal, onEvent, { commitSha });
    const raced = await Promise.race([
      playPromise.then((r) => ({ tag: "done" as const, r })),
      sleep(PLAYTEST_CLIENT_TIMEOUT_MS).then(() => ({ tag: "timeout" as const })),
    ]);

    if (raced.tag === "timeout") {
      acceptEvents = false;
      scan.playtest.status = "partial";
      console.log(
        `[playtest] no COMPLETE after ${PLAYTEST_CLIENT_TIMEOUT_MS / 1000}s — marking partial with ${scan.playtest.findings.length} finding(s) and continuing`,
      );
      await saveScan(scan);
      void playPromise.catch((e) =>
        console.warn("[playtest] background error after client timeout:", e instanceof Error ? e.message : e),
      );
      return;
    }

    acceptEvents = false;
    const r = raced.r;
    if (r.skipped) {
      scan.playtest.status = "skipped";
      scan.playtest.reason = r.reason;
      console.log(`[playtest] skipped: ${r.reason}`);
    } else {
      const { findings, notes } = extractFindings(r.result);
      scan.playtest.findings = findings;
      if (notes) scan.playtest.notes = notes;
      scan.playtest.status = "done";
      console.log(`[playtest] done with ${findings.length} finding(s)`);
    }

    // Real runs only: pull step screenshots for the UI replay (mock skips this).
    if (
      process.env.MOCK_TINYFISH !== "true" &&
      scan.playtest.runId &&
      ((scan.playtest.status as string) === "done" || (scan.playtest.status as string) === "partial")
    ) {
      try {
        const shots = await fetchRunStepShots(scan.playtest.runId);
        const purposes = scan.playtest.events
          .filter((e) => e.type === "PROGRESS")
          .map((e) => e.purpose || "");
        scan.playtest.steps = shots
          .map((s, i) => ({
            stepId: s.id,
            purpose: purposes[i] || s.action || `Step ${i + 1}`,
            imageSrc: s.screenshot || "",
          }))
          .filter((s) => s.imageSrc);
        console.log(`[playtest] saved ${scan.playtest.steps.length} step screenshot(s)`);
      } catch (e) {
        console.warn(
          "[playtest] screenshot fetch failed (scan continues):",
          e instanceof Error ? e.message : e,
        );
      }
    }

    await saveScan(scan);
  } catch (e) {
    acceptEvents = false;
    const msg = e instanceof Error ? e.message : String(e);
    scan.playtest.status = "error";
    scan.playtest.reason = msg.slice(0, 300);
    console.warn("[playtest] failed (scan continues):", scan.playtest.reason);
    await saveScan(scan);
  }
}

async function runPipeline(scan: Scan) {
  const step = async (s: string) => { scan.step = s; await saveScan(scan); };
  let dir = "";
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token || !process.env.GEMINI_API_KEY) throw new Error("Set GITHUB_TOKEN and GEMINI_API_KEY in .env");

    await step("Cloning repo");
    dir = await cloneRepo(scan.owner, scan.repo, token);

    await step("Running tests (before)");
    scan.testsBefore = await runTests(dir, true);

    const commitSha = (await run("git", ["rev-parse", "HEAD"], dir)).out.trim();
    scan.commitSha = commitSha;

    let findings: PlaytestFinding[] = [];
    if (scan.liveUrl) {
      await step("Playtesting live app");
      await runPlaytestPhase(scan, scan.liveUrl, commitSha);
      findings = scan.playtest?.findings ?? [];
    }

    await step("Gemini is hunting bugs");

    const findingsKey = playtestFindingsKey(findings);
    scan.playtestFindingsKey = findingsKey;

    let raw: RawBug[];
    const cached = (await listScans()).find(
      (s) =>
        s.id !== scan.id &&
        s.repoUrl === scan.repoUrl &&
        s.commitSha === commitSha &&
        (s.playtestFindingsKey ?? "none") === findingsKey &&
        s.status === "done" &&
        s.bugs.length > 0,
    );
    if (cached) {
      console.log("[debug-quest] cache hit");
      raw = cached.bugs.map(({ file, bugType, title, original, replacement, whatWasWrong, whyFixWorks, findingIndex }) => ({
        file, bugType, title, original, replacement, whatWasWrong, whyFixWorks, findingIndex,
      }));
    } else {
      console.log("[debug-quest] cache miss");
      const files = await readSources(dir);
      if (!files.length) throw new Error("No source files found");
      console.log(`[debug-quest] sending ${files.length} file(s) to Gemini: ${files.map((f) => f.path).join(", ")}`);
      raw = await findBugs(files, scan.testsBefore, findings);
    }

    // No playtest findings on this scan → never keep a cached/Gemini findingIndex.
    if (!findings.length) {
      raw = raw.map((b) => ({ ...b, findingIndex: null }));
    }

    const base = await gh.defaultBranch(scan.owner, scan.repo);
    const branch = `debug-quest/fix-${scan.id}`;
    await run("git", ["checkout", "-b", branch], dir);

    await step("Applying fixes on a new branch");
    for (const [i, b] of raw.entries()) {
      const applied = await applyPatch(dir, b.file, b.original, b.replacement);
      scan.bugs.push({
        ...b,
        id: `${scan.id}-${i}`,
        applied,
        findingIndex: findings.length ? (b.findingIndex ?? null) : null,
      });
    }
    const applied = scan.bugs.filter((b) => b.applied);
    if (!applied.length) throw new Error("Gemini found no patchable bugs");

    await step("Running tests (after)");
    scan.testsAfter = await runTests(dir, false);

    const git = (...a: string[]) => run("git", ["-c", "user.name=Debug Quest", "-c", "user.email=bot@debug-quest.dev", ...a], dir);
    await run("git", ["checkout", "--", "package-lock.json"], dir).catch(() => {});
    await git("add", "-A", ":!node_modules");
    await git("commit", "-m", `Debug Quest: fix ${applied.length} bug(s)`);
    scan.branch = branch;

    const dryRun = process.env.DRY_RUN === "true";
    if (dryRun) {
      scan.dryRun = true;
      console.log("[debug-quest] DRY_RUN=true — skipping push and PR");
      scan.status = "done";
      scan.step = "Dry run: PR skipped";
    } else {
      await step("Opening pull request");
      let headOwner = scan.owner;
      let remote = "origin";
      if (!(await gh.canPush(scan.owner, scan.repo))) {
        const me = await gh.whoami();
        await gh.ensureFork(scan.owner, scan.repo, me);
        headOwner = me;
        remote = "fork";
        await git("remote", "add", "fork", `https://x-access-token:${token}@github.com/${me}/${scan.repo}.git`);
      }
      const push = await git("push", remote, branch);
      if (push.code !== 0) throw new Error("git push failed: " + push.out.replaceAll(token, "***").slice(0, 300));

      const t = scan.testsAfter, b = scan.testsBefore;
      const testLine = b.ran && t?.ran ? `Tests: ${b.failing ?? "?"} failing -> ${t.failing ?? "?"} failing (\`${t.command}\`)` : "No test suite detected.";
      const pr = await gh.openPr({
        owner: scan.owner, repo: scan.repo, base,
        head: headOwner === scan.owner ? branch : `${headOwner}:${branch}`,
        title: `Debug Quest: ${applied.length} bug fix(es)`,
        body: `Automated fixes by Debug Quest (Gemini). \`${base}\` is untouched.\n\n${testLine}\n\n` +
          applied.map((x) => `- **${x.title}** (\`${x.file}\`, ${x.bugType})`).join("\n"),
      });
      scan.prUrl = pr.url;
      scan.prNumber = pr.number;
      scan.status = "done";
      scan.step = "Fix locked. Play to unlock.";
    }
    // Phone (ntfy) + Discord. The helper swallows errors, so alerts never break a scan.
    const appBase = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    void sendScanAlert({
      repoName: `${scan.owner}/${scan.repo}`,
      bugCount: applied.length,
      scanUrl: `${appBase}/scan/${scan.id}`,
    });
  } catch (e) {
    scan.status = "error";
    const full = (e instanceof Error ? e.message : String(e)).replaceAll(process.env.GITHUB_TOKEN || "\0", "***");
    console.error("[debug-quest] scan error:", full);
    if (/429|RESOURCE_EXHAUSTED/.test(full)) {
      scan.error = "Gemini's daily limit is reached. Try again later or switch API key.";
    } else {
      scan.error = full.split("\n")[0].slice(0, 200);
    }
  } finally {
    await saveScan(scan);
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
