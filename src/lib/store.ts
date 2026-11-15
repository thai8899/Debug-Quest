import { promises as fs } from "fs";
import path from "path";
import type { Scan } from "./types";

// Swap this module for MongoDB Atlas later; the interface stays the same.
const DIR = path.join(process.cwd(), ".data");

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, "");
}

function parseScanJson(text: string, label: string): Scan | null {
  try {
    return JSON.parse(stripBom(text)) as Scan;
  } catch (e) {
    console.warn(`[debug-quest] skipping unreadable JSON (${label}):`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function file(id: string) {
  await fs.mkdir(DIR, { recursive: true });
  return path.join(DIR, `${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

export async function saveScan(scan: Scan) {
  // UTF-8 without BOM (Buffer.from utf8 never prepends U+FEFF).
  await fs.writeFile(await file(scan.id), Buffer.from(JSON.stringify(scan, null, 2), "utf8"));
}

export async function getScan(id: string): Promise<Scan | null> {
  try {
    const text = await fs.readFile(await file(id), "utf8");
    return parseScanJson(text, id);
  } catch {
    return null;
  }
}

export async function listScans(): Promise<Scan[]> {
  await fs.mkdir(DIR, { recursive: true });
  const names = await fs.readdir(DIR);
  const scans = (
    await Promise.all(
      names
        .filter((n) => n.endsWith(".json"))
        .map(async (n) => {
          try {
            const text = await fs.readFile(path.join(DIR, n), "utf8");
            return parseScanJson(text, n);
          } catch (e) {
            console.warn(`[debug-quest] skipping unreadable JSON (${n}):`, e instanceof Error ? e.message : e);
            return null;
          }
        }),
    )
  ).filter((s): s is Scan => s !== null);
  return scans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
