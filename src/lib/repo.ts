import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { TestFailure, TestResult } from "./types";

type RunResult = { code: number; out: string };

export function run(cmd: string, args: string[], cwd: string, timeoutMs = 120_000): Promise<RunResult> {
  return new Promise((resolve) => {
    // Always argv array, never a shell string — spaces in args like user.name=Debug Quest stay intact.
    execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" } }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as NodeJS.ErrnoException).code === "number" ? ((err as unknown as { code: number }).code) : 1) : 0;
      const out = `${stdout}\n${stderr}`.trim() || (err ? String(err.message || err) : "");
      resolve({ code, out });
    });
  });
}

/** On win32, execFile("npm.cmd") fails with EINVAL — invoke npm via cmd.exe /c instead. */
function runNpm(args: string[], cwd: string, timeoutMs = 120_000): Promise<RunResult> {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", "npm", ...args], cwd, timeoutMs);
  }
  return run("npm", args, cwd, timeoutMs);
}

export function parseRepoUrl(url: string) {
  const m = url.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/#?].*)?$/i);
  if (!m) throw new Error("Not a GitHub repo URL");
  return { owner: m[1], repo: m[2] };
}

export async function cloneRepo(owner: string, repo: string, token?: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "debugquest-"));
  const auth = token ? `x-access-token:${token}@` : "";
  const r = await run("git", ["clone", "--depth", "1", `https://${auth}github.com/${owner}/${repo}.git`, dir], os.tmpdir(), 180_000);
  if (r.code !== 0) throw new Error("git clone failed: " + r.out.replaceAll(token ?? "\0", "***").slice(0, 300));
  return dir;
}

async function exists(p: string) {
  return fs.access(p).then(() => true, () => false);
}

function stripAnsi(s: string) {
  return s.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
}

/** Parse Jest ("Tests: 4 failed, 7 passed, 11 total") / pytest summary into {pass, fail}. */
export function parseCounts(out: string): { pass: number | null; fail: number | null } {
  const text = stripAnsi(out);

  // Prefer Jest/Vitest Tests: line (not Test Suites:) so suite counts don't win.
  const testsLine = text.match(/(?:^|\n)Tests:\s*([^\n]+)/i);
  if (testsLine) {
    const line = testsLine[1];
    const failM = line.match(/(\d+)\s+failed/i);
    const passM = line.match(/(\d+)\s+passed/i);
    const fail = failM ? parseInt(failM[1], 10) : passM ? 0 : null;
    const pass = passM ? parseInt(passM[1], 10) : failM ? 0 : null;
    return { pass, fail };
  }

  // pytest: "==== 4 failed, 7 passed in 0.12s ====" or "11 passed in 0.05s"
  const pytestLine = text.match(/={5,}\s*([^=\n]*?(?:failed|passed|error)[^=\n]*?)\s*={5,}/i)
    ?? text.match(/((?:\d+\s+(?:failed|passed|error).*)\s+in\s+[\d.]+s)/i);
  if (pytestLine) {
    const line = pytestLine[1];
    const failM = line.match(/(\d+)\s+failed/i);
    const passM = line.match(/(\d+)\s+passed/i);
    const errM = line.match(/(\d+)\s+error/i);
    const fail = (failM ? parseInt(failM[1], 10) : 0) + (errM ? parseInt(errM[1], 10) : 0);
    const pass = passM ? parseInt(passM[1], 10) : 0;
    if (failM || passM || errM) return { pass, fail };
  }

  // node:test / fallbacks
  const fail = text.match(/#\s*fail\s+(\d+)/i)?.[1] ?? text.match(/(\d+)\s+failing/i)?.[1];
  const pass = text.match(/#\s*pass\s+(\d+)/i)?.[1] ?? text.match(/(\d+)\s+passing/i)?.[1];
  return {
    fail: fail ? parseInt(fail, 10) : null,
    pass: pass ? parseInt(pass, 10) : null,
  };
}

/** Extract failing test names + error messages from Jest / pytest output. */
export function parseFailures(out: string): TestFailure[] {
  const text = stripAnsi(out);
  const failures: TestFailure[] = [];

  // pytest: FAILED path::test_name - message
  for (const m of text.matchAll(/^FAILED\s+(\S+)(?:\s+-\s+(.*))?$/gm)) {
    failures.push({ name: m[1], message: (m[2] || "").trim() });
  }
  if (failures.length) return failures;

  // Jest: "● Suite › test name" then indented assertion/error lines
  const blocks = text.split(/\n\s*●\s+/).slice(1);
  for (const block of blocks) {
    const lines = block.split("\n");
    const name = (lines[0] || "").trim();
    if (!name) continue;
    const msgLines: string[] = [];
    for (const line of lines.slice(1)) {
      if (/^\s*●\s+/.test(line) || /^\s*(PASS|FAIL|Test Suites:|Tests:)\b/.test(line)) break;
      const trimmed = line.trim();
      if (!trimmed) {
        if (msgLines.length) break;
        continue;
      }
      if (/^at\s+/.test(trimmed)) break;
      msgLines.push(trimmed);
      if (msgLines.length >= 6) break;
    }
    failures.push({ name, message: msgLines.join(" ").slice(0, 500) });
  }
  return failures;
}

async function installDeps(dir: string) {
  const hasLock = (await exists(path.join(dir, "package-lock.json")))
    || (await exists(path.join(dir, "npm-shrinkwrap.json")));
  const args = hasLock
    ? ["ci", "--no-audit", "--no-fund"]
    : ["install", "--no-audit", "--no-fund"];
  const r = await runNpm(args, dir, 180_000);
  if (r.code !== 0) {
    console.warn("[debug-quest] npm install failed:\n" + r.out.slice(-2000));
  }
}

export async function runTests(dir: string, install: boolean): Promise<TestResult> {
  let command = "";
  let r: RunResult | null = null;
  if (await exists(path.join(dir, "package.json"))) {
    const pkg = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) {
      if (install) await installDeps(dir);
      command = "npm test";
      r = await runNpm(["test"], dir);
    }
  }
  if (!r && ((await exists(path.join(dir, "pytest.ini"))) || (await exists(path.join(dir, "tests"))) || (await exists(path.join(dir, "pyproject.toml"))))) {
    command = "python3 -m pytest -q";
    r = await run("python3", ["-m", "pytest", "-q"], dir);
  }
  if (!r) return { command: "none detected", ran: false, failing: null, passing: null, exitCode: null, output: "", failures: [] };

  console.log(`[debug-quest] raw test output (${command}):\n` + r.out);

  const { fail, pass } = parseCounts(r.out);
  const failures = parseFailures(r.out);
  const failing = fail ?? (r.code === 0 ? 0 : failures.length || null);
  const passing = pass;
  return {
    command,
    ran: true,
    failing,
    passing,
    exitCode: r.code,
    output: r.out.slice(-8000),
    failures,
  };
}

const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", "venv", ".venv", "__pycache__", "coverage"]);
const CODE_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".java", ".rb", ".rs", ".c", ".cpp", ".cs", ".php", ".mjs", ".cjs"]);

export async function readSources(dir: string, maxBytes = 150_000) {
  const files: { path: string; content: string }[] = [];
  let total = 0;
  const srcDir = path.join(dir, "src");
  const hasSrc = await exists(srcDir);

  async function walk(d: string, forceInclude: boolean, skipSrcAtRoot: boolean) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      if (SKIP_DIR.has(e.name)) continue;
      // Already collected every src/ file first; don't walk it again from repo root.
      if (skipSrcAtRoot && e.name === "src" && e.isDirectory()) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        await walk(full, forceInclude || e.name === "src", false);
      } else if (CODE_EXT.has(path.extname(e.name))) {
        const content = await fs.readFile(full, "utf8");
        // Always include every file under src/; budget only applies outside src/.
        if (!forceInclude && total + content.length > maxBytes) continue;
        total += content.length;
        files.push({ path: path.relative(dir, full).replace(/\\/g, "/"), content });
      }
    }
  }

  // Prefer src/ first so every file under it is included before the budget fills elsewhere.
  if (hasSrc) await walk(srcDir, true, false);
  await walk(dir, false, hasSrc);

  console.log(`[debug-quest] scanned ${files.length} source file(s): ${files.map((f) => f.path).join(", ")}`);
  return files;
}

// Exact-match patch. Refuses ambiguous or missing matches so a wrong fix can't silently land.
export async function applyPatch(dir: string, file: string, original: string, replacement: string) {
  const full = path.resolve(dir, file);
  if (!full.startsWith(path.resolve(dir) + path.sep)) return false;
  const text = await fs.readFile(full, "utf8").catch(() => null);
  if (text === null || !original) return false;
  const first = text.indexOf(original);
  if (first === -1 || text.indexOf(original, first + 1) !== -1) return false;
  await fs.writeFile(full, text.slice(0, first) + replacement + text.slice(first + original.length));
  return true;
}
