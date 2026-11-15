import { readFileSync } from "fs";
import { resolve } from "path";
import { playtest } from "../src/lib/playtester";

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

const GOAL = "Add one to-do called 'test' and mark it complete.";

async function main() {
  const result = await playtest(
    "https://todomvc.com/examples/react/dist/",
    GOAL,
    (event) => {
      if (event.type === "STREAMING_URL" && event.streaming_url) {
        console.log(event.streaming_url);
      }
      console.log(`[${new Date().toISOString()}]`, event);
    },
  );

  console.log("\n--- final ---");
  console.log(result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
