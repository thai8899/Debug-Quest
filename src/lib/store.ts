import { promises as fs } from "fs";
import path from "path";
import type { Scan } from "./types";

// Swap this module for MongoDB Atlas later; the interface stays the same.
const DIR = path.join(process.cwd(), ".data");

async function file(id: string) {
  await fs.mkdir(DIR, { recursive: true });
  return path.join(DIR, `${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

export async function saveScan(scan: Scan) {
  await fs.writeFile(await file(scan.id), JSON.stringify(scan, null, 2));
}

export async function getScan(id: string): Promise<Scan | null> {
  try {
    return JSON.parse(await fs.readFile(await file(id), "utf8"));
  } catch {
    return null;
  }
}

export async function listScans(): Promise<Scan[]> {
  await fs.mkdir(DIR, { recursive: true });
  const names = await fs.readdir(DIR);
  const scans = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map(async (n) => JSON.parse(await fs.readFile(path.join(DIR, n), "utf8")) as Scan)
  );
  return scans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
