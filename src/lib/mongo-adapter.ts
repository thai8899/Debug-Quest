import type { Bug, Quiz } from "./contract";

// Talks to the same MongoDB as Harshitha's lib/mongo.ts (db "debugquest", collections bugs/quizzes)
// but converts between her field names (bugId, unlocked) and the team contract (id, locked) right here,
// so nothing else in the game changes. Docs are written with BOTH shapes so her helpers can read them too.
// Only active when MONGODB_URI is a real URI (no "<db_username>" placeholder).
export function mongoEnabled() {
  const u = process.env.MONGODB_URI;
  return !!u && !u.includes("<") && !u.includes(">");
}

type AnyDoc = Record<string, unknown>;
const g = globalThis as unknown as { __dqMongo?: Promise<import("mongodb").Db> };

async function db() {
  g.__dqMongo ??= (async () => {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI as string, { serverSelectionTimeoutMS: 6000 });
    return (await client.connect()).db("debugquest");
  })();
  try { return await g.__dqMongo; } catch (e) { g.__dqMongo = undefined; throw e; }
}

export function fromDocBug(d: AnyDoc): Bug {
  const { _id: _i, bugId, unlocked, ...rest } = d;
  void _i;
  const id = (rest.id as string | undefined) ?? (bugId as string);
  const locked = typeof rest.locked === "boolean" ? rest.locked : !unlocked;
  return { ...(rest as object), id, locked } as Bug;
}
export function toDocBug(b: Bug): AnyDoc {
  return { ...b, bugId: b.id, unlocked: !b.locked };
}

export async function mGetBug(id: string) {
  const d = await (await db()).collection("bugs").findOne({ $or: [{ id }, { bugId: id }] });
  return d ? fromDocBug(d as AnyDoc) : null;
}
export async function mGetBugsForScan(scanId: string) {
  const ds = await (await db()).collection("bugs").find({ scanId }).toArray();
  return ds.map((d) => fromDocBug(d as AnyDoc));
}
export async function mSaveBugs(bugs: Bug[]) {
  const c = (await db()).collection("bugs");
  for (const b of bugs) await c.replaceOne({ bugId: b.id }, toDocBug(b), { upsert: true });
}
export async function mUnlockBug(id: string) {
  await (await db()).collection("bugs").updateOne(
    { $or: [{ id }, { bugId: id }] },
    { $set: { locked: false, unlocked: true, unlockedAt: new Date() } },
  );
}
export async function mGetQuiz(bugId: string) {
  const d = await (await db()).collection("quizzes").findOne({ bugId });
  if (!d) return null;
  const { _id: _i, ...rest } = d as AnyDoc;
  void _i;
  return rest as unknown as Quiz;
}
export async function mSaveQuiz(q: Quiz) {
  await (await db()).collection("quizzes").replaceOne({ bugId: q.bugId }, { ...q }, { upsert: true });
}
