import https from "https";
import type { IncomingHttpHeaders, IncomingMessage } from "http";
import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export const DEFAULT_GOAL =
  "You are a QA tester checking a web app before release. Try every button, link and form, including edge cases like empty fields. Note any error message, crash, blank area or wrong count. For each problem return page, action, expected, actual. If the site doesn't load or you are blocked, return empty findings and explain in notes.";

const SSE_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";
const RUNS_URL = "https://agent.tinyfish.ai/v1/runs";
const MAX_CONNECTION_MS = 4 * 60 * 1000;
const POLL_INTERVAL_MS = 5_000;
const FIXTURES_DIR = join(process.cwd(), "fixtures");
const CACHE_DIR = join(process.cwd(), ".data", "playtest-cache");

const SKIP_CODES = new Set([
  "TASK_FAILED",
  "SITE_BLOCKED",
  "TIMEOUT",
  "BILLING_REJECTED",
]);

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page: { type: "string" },
          action: { type: "string" },
          expected: { type: "string" },
          actual: { type: "string" },
        },
        required: ["page", "action", "expected", "actual"],
      },
    },
    notes: { type: "string" },
  },
  required: ["findings", "notes"],
};

export type PlaytestEvent =
  | { type: "STARTED"; run_id?: string; [key: string]: unknown }
  | { type: "STREAMING_URL"; streaming_url?: string; [key: string]: unknown }
  | { type: "PROGRESS"; purpose?: string; [key: string]: unknown }
  | {
      type: "COMPLETE";
      status?: string;
      result?: unknown;
      error?: unknown;
      [key: string]: unknown;
    };

export type PlaytestResult =
  | { skipped: true; reason: string; events: PlaytestEvent[] }
  | {
      skipped: false;
      status: string;
      result: unknown;
      error: unknown;
      events: PlaytestEvent[];
    };

type CacheEntry = {
  liveUrl: string;
  goal: string;
  commitSha: string;
  cachedAt: string;
  result: PlaytestResult;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function repoCommitSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function cacheKey(liveUrl: string, goal: string, commitSha: string) {
  return createHash("sha256")
    .update(JSON.stringify({ liveUrl, goal, commitSha }))
    .digest("hex");
}

function readCache(liveUrl: string, goal: string, commitSha: string): PlaytestResult | null {
  const path = join(CACHE_DIR, `${cacheKey(liveUrl, goal, commitSha)}.json`);
  if (!existsSync(path)) return null;
  try {
    const entry = JSON.parse(readFileSync(path, "utf8")) as CacheEntry;
    return entry.result;
  } catch {
    return null;
  }
}

function writeCache(liveUrl: string, goal: string, commitSha: string, result: PlaytestResult) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, `${cacheKey(liveUrl, goal, commitSha)}.json`);
  const entry: CacheEntry = {
    liveUrl,
    goal,
    commitSha,
    cachedAt: new Date().toISOString(),
    result,
  };
  writeFileSync(path, JSON.stringify(entry, null, 2), "utf8");
}

function saveFixture(events: PlaytestEvent[]) {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(FIXTURES_DIR, `playtest-${stamp}.json`);
  writeFileSync(path, JSON.stringify(events, null, 2), "utf8");
  return path;
}

function newestFixturePath(): string {
  if (!existsSync(FIXTURES_DIR)) {
    throw new Error("No fixtures/ directory — cannot mock TinyFish");
  }
  const names = readdirSync(FIXTURES_DIR).filter(
    (n) => n.startsWith("playtest-") && n.endsWith(".json"),
  );
  if (!names.length) throw new Error("No fixtures/playtest-*.json — cannot mock TinyFish");
  names.sort();
  return join(FIXTURES_DIR, names[names.length - 1]!);
}

function resultFromEvents(events: PlaytestEvent[]): PlaytestResult {
  const complete = [...events].reverse().find((e) => e.type === "COMPLETE") as
    | (PlaytestEvent & { type: "COMPLETE" })
    | undefined;
  if (!complete) {
    throw new Error("Fixture/cache events missing COMPLETE");
  }
  const code = errorCode(complete.error);
  if (code && SKIP_CODES.has(code)) {
    return { skipped: true, reason: code, events };
  }
  return {
    skipped: false,
    status: String(complete.status ?? "UNKNOWN"),
    result: complete.result ?? null,
    error: complete.error ?? null,
    events,
  };
}

async function replayEvents(
  events: PlaytestEvent[],
  onEvent: (event: PlaytestEvent) => void,
  gapMs: number,
) {
  for (const event of events) {
    onEvent(event);
    if (gapMs > 0) await sleep(gapMs);
  }
}

async function mockPlaytest(onEvent: (event: PlaytestEvent) => void): Promise<PlaytestResult> {
  const path = newestFixturePath();
  console.log(`[playtest] MOCK_TINYFISH=true — replaying ${path}`);
  const events = JSON.parse(readFileSync(path, "utf8")) as PlaytestEvent[];
  await replayEvents(events, onEvent, 1000);
  return resultFromEvents(events);
}

function httpsRequest(
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ statusCode: number; headers: IncomingHttpHeaders; stream: IncomingMessage }> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          ...headers,
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }
            : {}),
        },
        timeout: 60_000,
      },
      (res) => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          stream: res,
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("request timed out"));
    });
    req.setTimeout(MAX_CONNECTION_MS);
    if (body) req.write(body);
    req.end();
  });
}

function readBody(stream: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

async function getJson(url: string, apiKey: string): Promise<Record<string, unknown>> {
  const { statusCode, stream } = await httpsRequest("GET", url, {
    "X-API-Key": apiKey,
    Accept: "application/json",
  });
  const text = await readBody(stream);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`GET ${url} failed (${statusCode}): ${text.slice(0, 300)}`);
  }
  return data;
}

async function pollRun(
  runId: string,
  apiKey: string,
  onEvent: (event: PlaytestEvent) => void,
  events: PlaytestEvent[],
): Promise<PlaytestEvent & { type: "COMPLETE" }> {
  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    const run = await getJson(`${RUNS_URL}/${runId}`, apiKey);
    const status = String(run.status ?? "");
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      const event: PlaytestEvent = {
        type: "COMPLETE",
        run_id: runId,
        status,
        result: run.result ?? null,
        error: run.error ?? null,
      };
      events.push(event);
      onEvent(event);
      return event as PlaytestEvent & { type: "COMPLETE" };
    }
  }
}

function handleSseLine(
  line: string,
  onEvent: (event: PlaytestEvent) => void,
  events: PlaytestEvent[],
  state: { runId?: string; complete?: PlaytestEvent & { type: "COMPLETE" } },
) {
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith("data:")) return;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return;
  }

  const type = raw.type;
  if (type === "STARTED") {
    const event: PlaytestEvent = { ...raw, type: "STARTED" };
    if (typeof raw.run_id === "string") state.runId = raw.run_id;
    events.push(event);
    onEvent(event);
  } else if (type === "STREAMING_URL") {
    const event: PlaytestEvent = {
      ...raw,
      type: "STREAMING_URL",
      streaming_url: raw.streaming_url as string | undefined,
    };
    events.push(event);
    onEvent(event);
  } else if (type === "PROGRESS") {
    const event: PlaytestEvent = {
      ...raw,
      type: "PROGRESS",
      purpose: raw.purpose as string | undefined,
    };
    events.push(event);
    onEvent(event);
  } else if (type === "COMPLETE") {
    const event: PlaytestEvent = {
      ...raw,
      type: "COMPLETE",
      status: raw.status as string | undefined,
      result: raw.result,
      error: raw.error,
    };
    events.push(event);
    onEvent(event);
    state.complete = event as PlaytestEvent & { type: "COMPLETE" };
  }
}

async function realPlaytest(
  liveUrl: string,
  goal: string,
  onEvent: (event: PlaytestEvent) => void,
): Promise<PlaytestResult> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new Error("Missing TINYFISH_API_KEY");

  const requestBody = {
    url: liveUrl,
    goal,
    output_schema: OUTPUT_SCHEMA,
    agent_config: { max_duration_seconds: 180 },
  };
  console.log("[playtest] request body:", JSON.stringify(requestBody, null, 2));

  const body = JSON.stringify(requestBody);
  const startedAt = Date.now();
  const events: PlaytestEvent[] = [];

  const { statusCode, stream } = await httpsRequest(
    "POST",
    SSE_URL,
    {
      "X-API-Key": apiKey,
      Accept: "text/event-stream",
    },
    body,
  );

  if (statusCode < 200 || statusCode >= 300) {
    const text = await readBody(stream);
    let parsed: { error?: unknown } = {};
    try {
      parsed = JSON.parse(text) as { error?: unknown };
    } catch {
      /* ignore */
    }
    const code = errorCode(parsed.error) ?? `HTTP_${statusCode}`;
    if (SKIP_CODES.has(code)) {
      return { skipped: true, reason: code, events };
    }
    throw new Error(`run-sse failed (${statusCode}): ${text.slice(0, 400)}`);
  }

  const state: { runId?: string; complete?: PlaytestEvent & { type: "COMPLETE" } } = {};
  let buffer = "";

  try {
    await new Promise<void>((resolve, reject) => {
      const hardStop = setTimeout(() => {
        stream.destroy();
        reject(new Error("SSE connection exceeded 4 minutes"));
      }, MAX_CONNECTION_MS);

      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        buffer += chunk;
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? "";
        for (const line of parts) handleSseLine(line, onEvent, events, state);
      });
      stream.on("end", () => {
        if (buffer.trim()) handleSseLine(buffer, onEvent, events, state);
        clearTimeout(hardStop);
        resolve();
      });
      stream.on("error", (err) => {
        clearTimeout(hardStop);
        reject(err);
      });
    });
  } catch (err) {
    if (!state.complete && !state.runId) throw err;
  }

  let complete = state.complete;
  if (!complete) {
    if (!state.runId) {
      if (events.length) saveFixture(events);
      throw new Error("SSE ended before STARTED/COMPLETE and no run_id to poll");
    }
    complete = await pollRun(state.runId, apiKey, onEvent, events);
  }

  if (events.length) saveFixture(events);

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const stepCount = events.filter((e) => e.type === "PROGRESS").length;
  console.log(`[playtest] real run finished in ${durationSec}s with ${stepCount} steps`);

  const code = errorCode(complete.error);
  if (code && SKIP_CODES.has(code)) {
    return { skipped: true, reason: code, events };
  }

  return {
    skipped: false,
    status: String(complete.status ?? "UNKNOWN"),
    result: complete.result ?? null,
    error: complete.error ?? null,
    events,
  };
}

export async function playtest(
  liveUrl: string,
  goal: string,
  onEvent: (event: PlaytestEvent) => void,
): Promise<PlaytestResult> {
  if (process.env.MOCK_TINYFISH === "true") {
    return mockPlaytest(onEvent);
  }

  const commitSha = repoCommitSha();
  const cached = readCache(liveUrl, goal, commitSha);
  if (cached) {
    console.log(`[playtest] cache hit for commit ${commitSha.slice(0, 7)}`);
    await replayEvents(cached.events, onEvent, 0);
    return cached;
  }

  console.log(`[playtest] cache miss for commit ${commitSha.slice(0, 7)}`);
  const result = await realPlaytest(liveUrl, goal, onEvent);
  writeCache(liveUrl, goal, commitSha, result);
  return result;
}
