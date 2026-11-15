// Harshitha's MongoDB helpers, kept under the same names so anything importing "@/lib/mongo" keeps working.
// They now sit on top of mongo-adapter.ts, which owns the connection and maps her field names (bugId, unlocked)
// to the team contract (id, locked). Changes from her original:
//  - the missing User/Repo/Quiz imports are replaced by real types (contract.ts + a local User type)
//  - no throw at import time, so builds and tests work without MONGODB_URI; calls fail only when actually used
import type { Bug, Quiz } from "./contract";
import type { Scan } from "./types";
import { getMongoDb, mGetBugsForScan, mGetQuiz, mSaveBugs, mSaveQuiz, mUnlockBug, mongoEnabled } from "./mongo-adapter";

export type User = { userId: string; createdAt: Date };

export { mongoEnabled };
export const getDb = getMongoDb;

function need() {
  if (!mongoEnabled()) throw new Error("MongoDB is not configured: set MONGODB_URI in .env.local");
}

export async function getOrCreateUser(userId: string): Promise<User> {
  need();
  const users = (await getDb()).collection<User>("users");
  const existing = await users.findOne({ userId });
  if (existing) return { userId: existing.userId, createdAt: existing.createdAt };
  const user = { userId, createdAt: new Date() };
  await users.insertOne({ ...user });
  return user;
}

// Scans are stored with both `id` (pipeline) and `scanId` (her queries) so either name finds them.
export async function insertScan(scan: Scan) {
  need();
  return (await getDb()).collection("scans").replaceOne({ scanId: scan.id }, { ...scan, scanId: scan.id }, { upsert: true });
}

export async function getScan(scanId: string): Promise<Scan | null> {
  need();
  const d = await (await getDb()).collection("scans").findOne({ $or: [{ id: scanId }, { scanId }] });
  if (!d) return null;
  const { _id: _i, scanId: _s, ...rest } = d;
  void _i; void _s;
  return rest as unknown as Scan;
}

export async function insertBugs(bugs: Bug[]) { need(); return mSaveBugs(bugs); }
export async function getBugsForScan(scanId: string) { need(); return mGetBugsForScan(scanId); }
export async function unlockBug(bugId: string) { need(); return mUnlockBug(bugId); }
export async function saveQuiz(quiz: Quiz) { need(); return mSaveQuiz(quiz); }
export async function getQuiz(bugId: string) { need(); return mGetQuiz(bugId); }
