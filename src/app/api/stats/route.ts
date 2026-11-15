import { NextResponse } from 'next/server';
import { getPool } from '@/lib/tiger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'demo';

  try {
    // Resolve DB only when this route runs — never at module import / build time.
    const pool = getPool();

    // 1. XP Total + level
    const xpRes = await pool.query(
      'SELECT COALESCE(SUM(xp), 0) AS total FROM xp_events WHERE user_id = $1',
      [userId]
    );
    const xpTotal = parseInt(xpRes.rows[0].total, 10);
    const level = Math.floor(xpTotal / 200) + 1;

    // 2. XP Series (last 24h) — roll per-category CAGG rows into one sum per bucket
    const seriesRes = await pool.query(
      `
      SELECT bucket, SUM(xp)::FLOAT AS xp_sum
      FROM xp_by_15min
      WHERE user_id = $1 AND bucket >= NOW() - INTERVAL '24 hours'
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
      [userId]
    );

    // 3. Pass rate per bug_category
    const passRateRes = await pool.query(
      `
      SELECT bug_category,
             COUNT(*) FILTER (WHERE event = 'quiz_pass')::FLOAT
               / NULLIF(COUNT(*), 0) AS pass_rate
      FROM xp_events
      WHERE user_id = $1 AND event IN ('quiz_pass', 'quiz_fail')
      GROUP BY bug_category
      ORDER BY bug_category
    `,
      [userId]
    );

    // 4. Weak categories — most quiz_fail events in the last 7 days
    const weakRes = await pool.query(
      `
      SELECT bug_category, COUNT(*) AS fails
      FROM xp_events
      WHERE user_id = $1
        AND event = 'quiz_fail'
        AND time >= NOW() - INTERVAL '7 days'
      GROUP BY bug_category
      ORDER BY fails DESC
      LIMIT 3
    `,
      [userId]
    );

    // 5. Scan totals (bugs fixed + tests fixed)
    const metricsRes = await pool.query(`
      SELECT
        COALESCE(SUM(bugs_found), 0) AS bugs_fixed,
        COALESCE(SUM(tests_failing_before - tests_failing_after), 0) AS tests_fixed
      FROM scan_metrics
    `);

    return NextResponse.json({
      xpTotal,
      level,
      xpSeries: seriesRes.rows.map((r) => ({
        bucket: r.bucket,
        xp_sum: Number(r.xp_sum) || 0,
      })),
      passRate: passRateRes.rows.map((r) => ({
        bug_category: r.bug_category,
        pass_rate: Number(r.pass_rate) || 0,
      })),
      weakCategories: weakRes.rows.map((r) => r.bug_category),
      bugsFixedTotal: parseInt(metricsRes.rows[0].bugs_fixed, 10),
      testsFixedTotal: parseInt(metricsRes.rows[0].tests_fixed, 10),
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
