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

const GOAL =
  "You are a QA tester. Add three to-dos, mark one complete, use the All / Active / Completed filters, edit a to-do, delete one, and try adding an empty to-do. Report anything that doesn't behave as expected.";

async function main() {
  const result = await playtest(
    "https://todomvc.com/examples/react/dist/",
    GOAL,
    (event) => {
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
