process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.TIGER_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  const userId = 'demo';
  const categories = ['null-check', 'async', 'type-error', 'logic-error', 'syntax'];
  
  await pool.query('DELETE FROM xp_events WHERE user_id = $1', [userId]);

  let queries = [];
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - 7); // Start 1 week ago

  for (let i = 0; i < 150; i++) {
    // Progressively better win rate
    const passProbability = 0.3 + (i / 150) * 0.6; 
    const event = Math.random() < passProbability ? 'quiz_pass' : 'quiz_fail';
    
    const catRoll = Math.random();
    const bugCategory = catRoll < 0.4 ? 'null-check' : catRoll < 0.8 ? 'async' : categories[Math.floor(Math.random() * categories.length)];
    
    const xp = event === 'quiz_pass' ? 50 : 10;
    const timeToSolve = Math.floor(Math.random() * 120) + 15;
    
    currentDate.setMinutes(currentDate.getMinutes() + Math.floor(Math.random() * 60) + 10);
    if (currentDate > new Date()) break;

    queries.push(
      pool.query(`
        INSERT INTO xp_events (user_id, event, bug_category, xp, seconds_to_solve, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, event, bugCategory, xp, timeToSolve, currentDate.toISOString()])
    );
  }

  await Promise.all(queries);
  
  await pool.query(`CALL refresh_continuous_aggregate('xp_by_15min', NULL, NULL);`);
  
  console.log('Demo data seeded successfully.');
  process.exit(0);
}

seed().catch(console.error);