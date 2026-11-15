# Debug Quest

Your AI did the work. Now earn it.

Built by Oluwafemi Omotowa for SunHacks 2026.

Paste a GitHub repo. Gemini finds bugs, fixes them on a new branch (main is never touched), opens a PR, and **locks** the fix behind a quiz built from the repo's own code.

## Run

    cp .env.example .env   # add GEMINI_API_KEY and GITHUB_TOKEN (repo scope)
    npm install && npm run dev

## Status
- [x] Scan pipeline: clone, tests before/after, Gemini patches, branch + PR (fork fallback)
- [ ] Unlock quiz (Gemini from the diff) + gate
- [ ] Grok bot notification (Discord/Telegram)
- [ ] MongoDB Atlas store (swap `src/lib/store.ts`), Tiger Data XP timeline
- [ ] Dashboard + locked tiles, deploy on Vultr

Note: scans run the target repo's test suite on the server. Only scan repos you trust.

## Unlock game (Phemmy's lane)
- Demo without other lanes: `/scan/demo` (3 locked bugs), `/scan/demo-running` (loading state), then click a card.
- Quiz grading is server-side only (`/api/quiz/[bugId]/answer`); the browser never gets answers.
- Stand-ins to swap once teammates push: `src/lib/data.ts` -> Harshitha's `lib/mongo.ts`, `src/lib/xp.ts` -> `lib/tiger.ts`, `src/app/api/scan/[id]/route.ts` -> Punarva's real route.
- Punarva: call `prepareQuizzes(bugs)` from `src/lib/quiz.ts` after saving a scan's bugs so quizzes are ready.

## Unlock game: "Bug Chomp" (Phemmy's lane)

Replaces the quiz as the main unlock flow (the old `/quiz/[bugId]` screen and `/api/quiz/*` routes still work).

- Page: `/play/[bugId]`. The bug-bot walks the buggy code line by line; the player spends a budget attaching guards to lines; the server runs the test.
- `GET /api/game/[bugId]` returns the board (symptom, budget, guard tools, code lines). It never contains the answers.
- `POST /api/game/[bugId]/run` with `{ placements: { [stationId]: guardId }, secondsToSolve }`. Server simulates the run and grades it. Fail returns only where the bug-bot crashed (and a hint after the 2nd fail). Pass unlocks the bug, records `quiz_pass` XP (50 / 70 / 90 for 1 / 2 / 3 stars) and returns the unlocked bug.
- Levels are generated from the bug (Gemini, validated) with a diff-based fallback; demo bugs have hand-written levels. For the scan pipeline: call `prepareLevels(bugs)` from `src/lib/game.ts` after saving bugs (like `prepareQuizzes`).
