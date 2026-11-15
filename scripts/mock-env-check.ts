/**
 * Local mock check — no real Tiger/Mongo needed.
 * Run: npm run test:mock
 *
 * Verifies:
 * 1. tiger / mongo import safely without env URLs
 * 2. getPool / mongo helpers throw only when called
 * 3. quiz grading works with a canned mock quiz
 */

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, err: unknown) {
  failed += 1;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  FAIL  ${name}`);
  console.log(`        ${msg}`);
}

async function main() {
  console.log('\nDebug Quest — mock env / types check\n');

  delete process.env.TIGER_DATABASE_URL;
  delete process.env.MONGODB_URI;

  // --- 1. tiger: import OK, getPool throws ---
  console.log('tiger.ts');
  try {
    const tiger = await import('../src/lib/tiger');
    ok('import without TIGER_DATABASE_URL');
    try {
      tiger.getPool();
      fail('getPool throws when URL missing', 'expected throw, got pool');
    } catch (e) {
      if (e instanceof Error && e.message.includes('TIGER_DATABASE_URL')) {
        ok('getPool throws only when called');
      } else {
        fail('getPool throws when URL missing', e);
      }
    }
  } catch (e) {
    fail('import without TIGER_DATABASE_URL', e);
  }

  // --- 2. mongo: import OK, helpers throw only when used ---
  console.log('\nmongo.ts');
  try {
    const mongo = await import('../src/lib/mongo');
    ok('import without MONGODB_URI');
    try {
      await mongo.getOrCreateUser('demo');
      fail('getOrCreateUser throws when URI missing', 'expected throw');
    } catch (e) {
      if (e instanceof Error && /MongoDB|MONGODB_URI/i.test(e.message)) {
        ok('getOrCreateUser throws only when called');
      } else {
        fail('getOrCreateUser throws when URI missing', e);
      }
    }
  } catch (e) {
    fail('import without MONGODB_URI', e);
  }

  // --- 3. mock quiz grade (same rule as server: 2 of 3) ---
  console.log('\nquiz grade (mock)');
  const { grade } = await import('../src/lib/quiz');
  const contractQuiz = {
    bugId: 'bug-1',
    passScore: 2,
    questions: [
      {
        type: 'spot-the-line' as const,
        prompt: 'Which line has the bug?',
        code: 'const x = a == b;',
        options: ['const x = a == b;'],
        answerIndex: 0,
        hint: 'Look at equality',
        whyCorrect: '== vs ===',
      },
      {
        type: 'predict' as const,
        prompt: 'What happens if value is null?',
        code: 'return value.length;',
        options: ['0', 'throws', 'undefined', 'null'],
        answerIndex: 1,
        hint: 'null has no length',
        whyCorrect: 'throws',
      },
      {
        type: 'pick-the-fix' as const,
        prompt: 'Pick the correct fix',
        code: 'if (i <= items.length)',
        options: ['i < items.length', 'i <= items.length', 'i == items.length'],
        answerIndex: 0,
        hint: 'off-by-one',
        whyCorrect: 'exclusive upper bound',
      },
    ],
  };

  const passResult = grade(contractQuiz, [0, 1, 0]);
  if (passResult.passed && passResult.correct === 3) ok('3/3 answers → passed');
  else fail('3/3 answers → passed', passResult);

  const barelyPass = grade(contractQuiz, [0, 1, 2]);
  if (barelyPass.passed && barelyPass.correct === 2) ok('2/3 answers → passed (passScore=2)');
  else fail('2/3 answers → passed', barelyPass);

  const failResult = grade(contractQuiz, [1, 0, 2]);
  if (!failResult.passed && failResult.correct === 0) ok('0/3 answers → failed');
  else fail('0/3 answers → failed', failResult);

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
    console.log('Mock check FAILED\n');
  } else {
    console.log('Mock check OK — safe to build without Tiger/Mongo env\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
