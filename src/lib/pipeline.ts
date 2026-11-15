import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import type { Scan } from "./types";
import { listScans, saveScan } from "./store";
import { applyPatch, cloneRepo, parseRepoUrl, readSources, run, runTests } from "./repo";
import { findBugs, type RawBug } from "./gemini";
import * as gh from "./github";
import { sendNtfyAlert } from "./notify";

export async function startScan(repoUrl: string): Promise<Scan> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const scan: Scan = {
    id: randomUUID().slice(0, 8),
    repoUrl, owner, repo,
    status: "running", step: "Queued", createdAt: new Date().toISOString(),
    bugs: [], locked: true,
  };
  await saveScan(scan);
  // Fire and forget; the UI polls /api/scans/[id].
  void runPipeline(scan);
  return scan;
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

    await step("Gemini is hunting bugs");
    const commitSha = (await run("git", ["rev-parse", "HEAD"], dir)).out.trim();
    scan.commitSha = commitSha;

    let raw: RawBug[];
    const cached = (await listScans()).find(
      (s) =>
        s.id !== scan.id &&
        s.repoUrl === scan.repoUrl &&
        s.commitSha === commitSha &&
        s.status === "done" &&
        s.bugs.length > 0,
    );
    if (cached) {
      console.log("[debug-quest] cache hit");
      raw = cached.bugs.map(({ file, bugType, title, original, replacement, whatWasWrong, whyFixWorks }) => ({
        file, bugType, title, original, replacement, whatWasWrong, whyFixWorks,
      }));
    } else {
      console.log("[debug-quest] cache miss");
      const files = await readSources(dir);
      if (!files.length) throw new Error("No source files found");
      console.log(`[debug-quest] sending ${files.length} file(s) to Gemini: ${files.map((f) => f.path).join(", ")}`);
      raw = await findBugs(files, scan.testsBefore);
    }

    const base = await gh.defaultBranch(scan.owner, scan.repo);
    const branch = `debug-quest/fix-${scan.id}`;
    await run("git", ["checkout", "-b", branch], dir);

    await step("Applying fixes on a new branch");
    for (const [i, b] of raw.entries()) {
      const applied = await applyPatch(dir, b.file, b.original, b.replacement);
      scan.bugs.push({ ...b, id: `${scan.id}-${i}`, applied });
    }
    const applied = scan.bugs.filter((b) => b.applied);
    if (!applied.length) throw new Error("Gemini found no patchable bugs");

    await step("Running tests (after)");
    scan.testsAfter = await runTests(dir, false);

    await step("Opening pull request");
    const git = (...a: string[]) => run("git", ["-c", "user.name=Debug Quest", "-c", "user.email=bot@debug-quest.dev", ...a], dir);
    await run("git", ["checkout", "--", "package-lock.json"], dir).catch(() => {});
    await git("add", "-A", ":!node_modules");
    await git("commit", "-m", `Debug Quest: fix ${applied.length} bug(s)`);

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
    scan.branch = branch; scan.prUrl = pr.url; scan.prNumber = pr.number;
    scan.status = "done"; scan.step = "Fix locked. Play to unlock.";

    // Phone alert — never await in a way that can break the scan (helper swallows errors).
    const appBase = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    void sendNtfyAlert({
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
