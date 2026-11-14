import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { TestResult } from "./types";

type RunResult = { code: number; out: string };

export function run(cmd: string, args: string[], cwd: string, timeoutMs = 120_000): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, CI: "1" } }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as NodeJS.ErrnoException).code === "number" ? ((err as unknown as { code: number }).code) : 1) : 0;
      resolve({ code, out: `${stdout}\n${stderr}`.trim() });
    });
  });
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

export function parseCounts(out: string): { failing: number | null; passing: number | null } {
  const pick = (re: RegExp) => {
    const m = out.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  // jest / vitest: "Tests: 4 failed, 6 passed"  | pytest: "4 failed, 6 passed" | node:test: "# fail 4"
  const failing = pick(/(\d+)\s+failed/i) ?? pick(/#\s*fail\s+(\d+)/i) ?? pick(/(\d+)\s+failing/i);
  const passing = pick(/(\d+)\s+passed/i) ?? pick(/#\s*pass\s+(\d+)/i) ?? pick(/(\d+)\s+passing/i);
  return { failing, passing };
}

export async function runTests(dir: string, install: boolean): Promise<TestResult> {
  let command = "";
  let r: RunResult | null = null;
  if (await exists(path.join(dir, "package.json"))) {
    const pkg = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) {
      if (install && !(await exists(path.join(dir, "node_modules")))) await run("npm", ["install", "--no-audit", "--no-fund"], dir, 180_000);
      command = "npm test";
      r = await run("npm", ["test"], dir);
    }
  }
  if (!r && ((await exists(path.join(dir, "pytest.ini"))) || (await exists(path.join(dir, "tests"))) || (await exists(path.join(dir, "pyproject.toml"))))) {
    command = "python3 -m pytest -q";
    r = await run("python3", ["-m", "pytest", "-q"], dir);
  }
  if (!r) return { command: "none detected", ran: false, failing: null, passing: null, exitCode: null, output: "" };
  const { failing, passing } = parseCounts(r.out);
  return { command, ran: true, failing: failing ?? (r.code === 0 ? 0 : null), passing, exitCode: r.code, output: r.out.slice(-4000) };
}

const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", "venv", ".venv", "__pycache__", "coverage"]);
const CODE_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".java", ".rb", ".rs", ".c", ".cpp", ".cs", ".php", ".mjs", ".cjs"]);

export async function readSources(dir: string, maxBytes = 150_000) {
  const files: { path: string; content: string }[] = [];
  let total = 0;
  async function walk(d: string) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      if (SKIP_DIR.has(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (CODE_EXT.has(path.extname(e.name))) {
        const content = await fs.readFile(full, "utf8");
        if (total + content.length > maxBytes) continue;
        total += content.length;
        files.push({ path: path.relative(dir, full), content });
      }
    }
  }
  await walk(dir);
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
