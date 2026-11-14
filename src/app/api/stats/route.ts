import { NextResponse } from 'next/server';
import { pool } from '@/lib/tiger'; // Export the pool from your tiger.ts


export async function GET(request: Request) {
  console.log("Checking DB URL:", process.env.TIGER_DATABASE_URL);
    const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'demo';

  try {
    // 1. XP Total
    const xpRes = await pool.query('SELECT COALESCE(SUM(xp), 0) as total FROM xp_events WHERE user_id = $1', [userId]);
    const xpTotal = parseInt(xpRes.rows[0].total, 10);
    const level = Math.floor(xpTotal / 200) + 1;

    // 2. XP Series (Last 24 hours)
    // xp_by_15min is a continuous aggregate keyed by (bucket, user_id, bug_category),
    // so roll the per-category rows up into one xp_sum per bucket.
    const seriesRes = await pool.query(`
      SELECT bucket, SUM(xp) AS xp_sum
      FROM xp_by_15min
      WHERE user_id = $1 AND bucket >= NOW() - INTERVAL '24 hours'
      GROUP BY bucket
      ORDER BY bucket ASC
    `, [userId]);

    // 3. Pass Rate per Category
    const passRateRes = await pool.query(`
      SELECT bug_category, 
             COUNT(*) FILTER (WHERE event = 'quiz_pass')::FLOAT / NULLIF(COUNT(*), 0) as pass_rate 
      FROM xp_events 
      WHERE user_id = $1 AND event IN ('quiz_pass', 'quiz_fail')
      GROUP BY bug_category
    `, [userId]);

  // 4. Weak Categories (Most fails in 7 days)
    const weakRes = await pool.query(`
      SELECT bug_category, COUNT(*) as fails 
      FROM xp_events 
      WHERE user_id = $1 AND event = 'quiz_fail' AND time >= NOW() - INTERVAL '7 days' 
      GROUP BY bug_category 
      ORDER BY fails DESC 
      LIMIT 3
    `, [userId]);

    // 5. Tests Fixed (Global or linked to user)
    const testsRes = await pool.query(`
      SELECT COALESCE(SUM(tests_failing_before - tests_failing_after), 0) as fixed 
      FROM scan_metrics
    `);

    return NextResponse.json({
      xpTotal,
      level,
      xpSeries: seriesRes.rows,
      passRate: passRateRes.rows,
      weakCategories: weakRes.rows.map(r => r.bug_category),
      testsFixedTotal: parseInt(testsRes.rows[0].fixed, 10)
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}