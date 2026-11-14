import { MongoClient, Db } from 'mongodb';
// Note: Ensure these types exist and match your schemas in lib/types.ts
import type { User, Repo, Scan, Bug, Quiz } from './types'; 

const uri = process.env.MONGODB_URI as string;
const dbName = 'debugquest';

if (!uri) throw new Error('Please add your MONGODB_URI to .env.local');

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
};

if (process.env.NODE_ENV === 'development') {
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}

// --- Typed Helpers ---

export async function getOrCreateUser(userId: string): Promise<User> {
  const db = await getDb();
  const users = db.collection<User>('users');
  const existing = await users.findOne({ userId });
  if (existing) return existing;
  
  const newUser = { userId, createdAt: new Date() } as User;
  await users.insertOne(newUser);
  return newUser;
}

export async function insertScan(scan: Scan) {
  const db = await getDb();
  return db.collection<Scan>('scans').insertOne(scan);
}

export async function getScan(scanId: string) {
  const db = await getDb();
  return db.collection<Scan>('scans').findOne({ scanId });
}

export async function insertBugs(bugs: Bug[]) {
  const db = await getDb();
  return db.collection<Bug>('bugs').insertMany(bugs);
}

export async function getBugsForScan(scanId: string) {
  const db = await getDb();
  return db.collection<Bug>('bugs').find({ scanId }).toArray();
}

export async function unlockBug(bugId: string) {
  const db = await getDb();
  return db.collection<Bug>('bugs').updateOne(
    { bugId },
    { $set: { unlocked: true, unlockedAt: new Date() } }
  );
}

export async function saveQuiz(quiz: Quiz) {
  const db = await getDb();
  return db.collection<Quiz>('quizzes').insertOne(quiz);
}

export async function getQuiz(bugId: string) {
  const db = await getDb();
  // Assuming bugId is used to link the quiz to the bug
  return db.collection<Quiz>('quizzes').findOne({ bugId });
}