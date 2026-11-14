import type { Scan } from "./types";

// While locked, the client only learns bug type and file, never the fix or explanation.
export function redact(scan: Scan): Scan {
  if (!scan.locked) return scan;
  return {
    ...scan,
    bugs: scan.bugs.map((b) => ({ ...b, title: "Locked bug", original: "", replacement: "", whatWasWrong: "", whyFixWorks: "" })),
  };
}
