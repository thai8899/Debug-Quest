import { Pool } from 'pg';

// Lazy pool so imports don't crash when env isn't loaded yet (e.g. during build).
let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

  const rawUrl = process.env.TIGER_DATABASE_URL;
  if (!rawUrl) {
    throw new Error('Please add your TIGER_DATABASE_URL to .env / .env.production');
  }

  // Managed providers (Timescale, etc.) often present a self-signed certificate.
  // Strip sslmode so rejectUnauthorized: false takes effect.
  const connectionString = (() => {
    try {
      const parsed = new URL(rawUrl);
      parsed.searchParams.delete('sslmode');
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  })();

  _pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  return _pool;
}

/** Shared pool for stats / queries. */
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const real = getPool() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
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
    params.secondsToSolve,
  ];
  const result = await getPool().query(query, values);
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
    params.testsFailingAfter,
  ];
  const result = await getPool().query(query, values);
  return result.rows[0];
}
