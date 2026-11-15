import { readFileSync } from "fs";
import { resolve } from "path";
import https from "https";

function loadEnv(file: string) {
  const text = readFileSync(resolve(file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(".env");

const apiKey = process.env.TINYFISH_API_KEY;
if (!apiKey) {
  console.error("Missing TINYFISH_API_KEY in .env");
  process.exit(1);
}

function postJson(url: string, headers: Record<string, string>, body: object) {
  const payload = JSON.stringify(body);
  const u = new URL(url);
  return new Promise<Record<string, unknown>>((resolvePromise, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 60_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolvePromise(JSON.parse(text) as Record<string, unknown>);
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("request timed out"));
    });
    req.setTimeout(180_000);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const data = await postJson(
    "https://agent.tinyfish.ai/v1/automation/run",
    { "X-API-Key": apiKey! },
    {
      url: "https://example.com",
      goal: "Extract the page title",
    },
  );

  console.log("status:", data.status);
  console.log("num_of_steps:", data.num_of_steps);
  console.log("result:", data.result);
  console.log("error:", data.error);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
