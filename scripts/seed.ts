process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const rawUrl = process.env.TIGER_DATABASE_URL;
if (!rawUrl) {
  console.error('Missing TIGER_DATABASE_URL in .env.local');
  process.exit(1);
}

const connectionString = (() => {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return rawUrl;
  }
})();

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const USER_ID = 'demo';
const DEMO_REPO = 'demo/debug-quest';
const CATEGORIES = ['null-check', 'async', 'type-error', 'logic-error', 'syntax'] as const;

function pickCategory(): string {
  const roll = Math.random();
  // Weighted toward null-check and async (the weak spots)
  if (roll < 0.35) return 'null-check';
  if (roll < 0.65) return 'async';
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function sessionsForDay(dayIndex: number): number {
  // A few sessions a day, slightly more later in the week
  return 2 + (dayIndex % 3);
}

async function seed() {
  // Safe to re-run: wipe this demo user's practice history + demo scan metrics
  await pool.query('DELETE FROM xp_events WHERE user_id = $1', [USER_ID]);
  await pool.query('DELETE FROM scan_metrics WHERE repo_id = $1', [DEMO_REPO]);

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  start.setUTCHours(10, 0, 0, 0);

  const rows: Array<{
    time: Date;
    event: string;
    bugCategory: string;
    xp: number;
    seconds: number;
  }> = [];

  for (let day = 0; day < 7; day++) {
    const sessionCount = sessionsForDay(day);
    // Improving: more fails early, more passes later
    const passProbability = 0.25 + (day / 6) * 0.55;

    for (let session = 0; session < sessionCount; session++) {
      const sessionStart = new Date(start);
      sessionStart.setUTCDate(start.getUTCDate() + day);
      sessionStart.setUTCHours(10 + session * 4, Math.floor(Math.random() * 40), 0, 0);

      const attempts = 2 + Math.floor(Math.random() * 3); // 2–4 per session
      let cursor = new Date(sessionStart);

      for (let a = 0; a < attempts; a++) {
        if (cursor > now) break;

        const event = Math.random() < passProbability ? 'quiz_pass' : 'quiz_fail';
        const bugCategory = pickCategory();
        // Modest XP so the demo lands around mid-single-digit levels
        const xp = event === 'quiz_pass' ? 25 : 5;
        const seconds = 20 + Math.floor(Math.random() * 140);

        rows.push({ time: new Date(cursor), event, bugCategory, xp, seconds });
        cursor = new Date(cursor.getTime() + (8 + Math.floor(Math.random() * 25)) * 60_000);
      }
    }
  }

  // Ensure some activity lands in the last 24h so the XP line chart is populated
  let recent = new Date(now.getTime() - 20 * 60 * 60 * 1000);
  for (let i = 0; i < 8; i++) {
    const event = Math.random() < 0.7 ? 'quiz_pass' : 'quiz_fail';
    rows.push({
      time: new Date(recent),
      event,
      bugCategory: pickCategory(),
      xp: event === 'quiz_pass' ? 25 : 5,
      seconds: 25 + Math.floor(Math.random() * 100),
    });
    recent = new Date(recent.getTime() + (70 + Math.floor(Math.random() * 60)) * 60_000);
    if (recent > now) break;
  }

  for (const row of rows) {
    await pool.query(
      `
      INSERT INTO xp_events (time, user_id, event, bug_category, xp, seconds_to_solve)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [row.time.toISOString(), USER_ID, row.event, row.bugCategory, row.xp, row.seconds]
    );
  }

  // A few scan_metrics rows so dashboard big numbers aren't zero
  const scanRows = [
    { bugs: 5, before: 12, after: 3, hoursAgo: 120 },
    { bugs: 3, before: 8, after: 1, hoursAgo: 48 },
    { bugs: 4, before: 10, after: 2, hoursAgo: 6 },
  ];
  for (const s of scanRows) {
    const t = new Date(now.getTime() - s.hoursAgo * 60 * 60 * 1000);
    await pool.query(
      `
      INSERT INTO scan_metrics (time, repo_id, bugs_found, tests_failing_before, tests_failing_after)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [t.toISOString(), DEMO_REPO, s.bugs, s.before, s.after]
    );
  }

  // Refresh continuous aggregate over the seeded window (and a little past "now")
  const refreshStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const refreshEnd = new Date(now.getTime() + 60 * 60 * 1000);
  await pool.query(`CALL refresh_continuous_aggregate('xp_by_15min', $1::timestamptz, $2::timestamptz)`, [
    refreshStart.toISOString(),
    refreshEnd.toISOString(),
  ]);

  console.log(`Demo data seeded: ${rows.length} xp_events, ${scanRows.length} scan_metrics for user "${USER_ID}".`);
  await pool.end();
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
