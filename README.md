# Debug Quest

**Your AI did the work. Now earn it.**

AI coding tools fix bugs faster than people can understand them. Debug Quest keeps the speed and puts the understanding back: the AI fixes your bugs, then locks each fix behind a short arcade game built from the bug itself. You unlock the plain-English explanation by playing, and you earn XP for it.

Built for SunHacks 2026 by Oluwafemi Omotowa, Punarva, Harshitha and Deepika.

Live demo: http://45.32.72.253:3000

## How it works

1. **Paste a GitHub repo.** Optionally add the URL of the live app too.
2. **Scan.** The server clones the repo, runs its tests, and asks Gemini to find and fix the bugs. The fixes go on a new branch and a pull request is opened. Your `main` is never touched.
3. **Playtest (optional).** If you gave a live URL, a TinyFish agent uses the running app like a real user. Gemini traces what broke back to the exact line of code. Bugs found this way get a "Found by Playtester" badge, with a live feed and a step-by-step screenshot replay.
4. **Locked fixes.** Each bug appears as a locked card. You can see where it is, but not what the fix was.
5. **Play to unlock.** Pick one of four arcade games, all built from that bug's own code:
   - **Bug Chomp:** a lion chomps the ghosts that hold buggy lines and leaves the good ones alone.
   - **Code Rain:** lines fall down three lanes; steer the lion into the buggy ones.
   - **Ghost Hunt:** ghosts drift around an open arena; send the lion after the buggy ones.
   - **Bug Pop:** pop the buggy tiles on a board of code lines across four rounds.
6. **Reveal and learn.** A pass unlocks a plain-English explanation of what went wrong and why the fix works. A 5-step tutorial walks through the buggy line, the reasoning, the diff and how to spot it next time.
7. **Stuck?** After 5 failed tries the tutorial opens anyway, so nobody is blocked. It gives no XP.
8. **XP and dashboard.** Passes earn XP (30 plus 20 per star), recorded in a timeline and shown on the dashboard.

## Why the unlock can't be gamed

Grading happens only on the server. The browser sees code lines and sends taps, never answers. Each round has a signed token and a schedule the server builds from a seed, and the server checks every tap against its own time window. To pass you must catch at least 70% of the bugs and lose fewer than 3 lives.

## Tech

- **App:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, framer-motion
- **AI:** Gemini for finding and fixing bugs, and for tracing playtest findings to code
- **Playtester:** TinyFish browser agent
- **Data:** MongoDB Atlas for scans and bugs, Tiger Data for the XP timeline
- **Alerts:** ntfy phone and Discord notifications (coming)
- **Hosting:** Vultr, run with pm2

## Run it locally

    git clone https://github.com/thai8899/Debug-Quest.git
    cd Debug-Quest
    cp .env.example .env     # then fill in the values below
    npm install
    npm run dev

Open http://localhost:3000. To try the game without scanning anything, visit `/scan/demo`.

| Variable | What it is |
| --- | --- |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini key and model name |
| `GITHUB_TOKEN` | Fine-grained token with Contents and Pull requests (read and write) on the repo you scan |
| `TINYFISH_API_KEY` | Key for the playtester agent |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `TIGER_DATABASE_URL` | Tiger Data connection string for the XP timeline |
| `DRY_RUN=true` | Fix bugs locally only; no branch or PR is created |
| `MOCK_TINYFISH=true` | Replay a saved playtest instead of spending credits |
| `LEVEL_TIMEOUT_MS` | How long to wait for Gemini when building a game level (default 8000) |

Never commit `.env`. For testing, keep `DRY_RUN` and `MOCK_TINYFISH` on.

Other commands: `npm run build`, `npm run typecheck`, `npm run seed` (demo data for the dashboard).

## Project layout

| Path | What lives there |
| --- | --- |
| `src/lib/pipeline.ts`, `repo.ts`, `gemini.ts` | The scan: clone, test, fix, branch, pull request |
| `src/lib/playtester.ts` | The TinyFish playtest and Gemini tracing |
| `src/lib/arcade.ts`, `src/lib/game.ts` | Server-side game rounds, grading and tutorial rules |
| `src/components/arcade/`, `ChompGame.tsx`, `Tutorial.tsx` | The four games and the tutorial |
| `src/app/api/game/[bugId]/` | `start`, `whack`, `finish` and `tutorial` endpoints |
| `src/lib/mongo.ts`, `tiger.ts`, `xp.ts` | Storage and XP |
| `src/app/dashboard`, `src/app/api/stats` | XP dashboard |

## Safety notes

- A scan runs the target repo's test suite on the server. Only scan repos you trust.
- Fixes always land on a new branch. A fork is used when you don't have push access.
- Keys, tokens and database passwords belong in `.env` only, never in the repo, screenshots or the demo video.

## Status

- [x] Scan pipeline: clone, tests before and after, Gemini fixes, branch and pull request
- [x] TinyFish playtester with live feed, replay and badges
- [x] Unlock game: four arcade modes, server grading, tutorial, XP
- [x] Dashboard and XP timeline
- [x] Deployed on Vultr
- [ ] Phone and Discord alerts (finished on a branch, not yet in `main`)
- [ ] Scans saved to MongoDB (the scan pipeline still writes local files)
