import { Pool } from 'pg';

const rawUrl = process.env.TIGER_DATABASE_URL;

if (!rawUrl) {
  throw new Error('Please add your TIGER_DATABASE_URL to .env.local');
}

// Managed providers (Timescale, etc.) often present a self-signed certificate.
// Newer versions of `pg` treat `sslmode=require` in the connection string as
// `verify-full`, which overrides the `ssl` option below and rejects the cert.
// Strip `sslmode` so our `rejectUnauthorized: false` setting takes effect.
const connectionString = (() => {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return rawUrl;
  }
})();

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for most managed cloud databases
  }
});

interface XpEventParams {
  userId: string;
  event: string;
  bugCategory: string;
  xp: number;
  secondsToSolve: number;
}

export async function recordXpEvent(params: XpEventParams) {
  const query = `
    INSERT INTO xp_events (user_id, event, bug_category, xp, seconds_to_solve)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [
    params.userId, 
    params.event, 
    params.bugCategory, 
    params.xp, 
    params.secondsToSolve
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

interface ScanMetricsParams {
  repoId: string;
  bugsFound: number;
  testsFailingBefore: number;
  testsFailingAfter: number;
}

export async function recordScanMetrics(params: ScanMetricsParams) {
  const query = `
    INSERT INTO scan_metrics (repo_id, bugs_found, tests_failing_before, tests_failing_after)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [
    params.repoId, 
    params.bugsFound, 
    params.testsFailingBefore, 
    params.testsFailingAfter
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}