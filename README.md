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
