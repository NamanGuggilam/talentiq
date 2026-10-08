# TalentIQ

Career-fair candidate capture with sourced summaries and human sign-off. A capstone prototype for the J.B. Hunt TalentIQ brief. It runs on synthetic data only.

A student makes a profile from their resume and taps a recruiter's badge. The recruiter adds notes and their own ratings. The AI drafts a summary in which every sentence names its source, and the recruiter approves it. The team then searches, compares and sets a status.

## Run it locally

Needs Node 22 or newer. No database server and no API key are required.

```bash
npm install
SEED_PASSWORD=choose-a-password npm run seed   # loads a synthetic career fair; prints the sign-in emails
npm run dev                                    # http://localhost:3000
```

Sign in at `/login` as `coordinator@talentiq.demo`, `dana.lee@talentiq.demo`, `sam.ortiz@talentiq.demo` or `priya.raman@talentiq.demo` with the password you chose. Without `SEED_PASSWORD` the seed script generates a password per account and prints it once.

Stop the dev server with Ctrl-C. Embedded Postgres needs a clean shutdown; if `.data/` ever fails to open, delete it and seed again.

To try the student side, open `/signup` in a private window, then scan or open the link on a recruiter's badge page.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Applies migrations when `DATABASE_URL` is set, then builds |
| `npm test` | Unit tests: source checker, rule engine, link reader safety, secrets |
| `npx playwright test` | Browser tests against a running, seeded server on port 3210 (see `playwright.config.ts`) |
| `npm run seed -- --reset` | Wipes and reloads the synthetic data |
| `npm run db:generate` | Creates a migration after editing `src/db/schema.ts` |
| `npm run lint`, `npm run typecheck` | Static checks |

## Configuration

Everything is optional locally. See `.env.example`.

| Variable | Effect |
|---|---|
| `DATABASE_URL` | Hosted Postgres. Unset: embedded Postgres (PGlite) in `./.data` |
| `ANTHROPIC_API_KEY` | Turns on Claude for resume reading, claim checks, summaries, questions and search |
| `AI_PROVIDER=mock` | Forces the rule-based engine even when a key is present |
| `AI_MODEL` | Defaults to `claude-opus-5` |
| `AI_DAILY_CAP` | Maximum model calls per day across the deployment (default 600) |
| `APP_URL` | Public origin for badge QR codes. Unset: taken from the request |
| `GITHUB_TOKEN` | Raises GitHub's rate limit when reading linked profiles |

## Deploying

Any Node host with Postgres works. On Vercel:

1. Create a Postgres database (Neon, Supabase or similar) and copy its pooled connection string.
2. Set `DATABASE_URL` on the project, plus `ANTHROPIC_API_KEY` if you want Claude drafting.
3. Deploy. The build runs the migrations.
4. Seed once from your machine: `DATABASE_URL=... SEED_PASSWORD=... npm run seed`.

## How it is put together

- **Next.js 16 App Router**, React 19, TypeScript, Tailwind 4. Read `AGENTS.md` before changing routes: this Next.js version differs from older ones.
- **Postgres through Drizzle.** Schema in `src/db/schema.ts`, migrations in `drizzle/`.
- **Server actions** in `src/app/actions/` do every write. Each one checks the session and what that person may touch.

| Area | Where |
|---|---|
| Sessions, password hashing, recovery codes | `src/lib/auth.ts`, `src/lib/crypto.ts` |
| Rate limits | `src/lib/rateLimit.ts` |
| Security headers and Content Security Policy | `src/proxy.ts` |
| AI entry points and fallback | `src/lib/ai/index.ts` |
| Claude prompts | `src/lib/ai/claude.ts` |
| Rule-based engine | `src/lib/ai/mock.ts` |
| Source checker | `src/lib/ai/validateCitations.ts` |
| Link reader and its safety checks | `src/lib/scrape/` |
| Claim and evidence pipeline | `src/lib/evidence.ts` |
| Study measures | `src/lib/measures.ts` |

### Rules the code enforces

- The AI never scores, ranks, rejects or advances anyone. There is no verification score. Natural-language search refuses ranking questions in code before a model is called.
- Ratings are typed in by a recruiter, shown with that recruiter's name, and are not part of the summary input type, so they cannot reach a prompt.
- Every drafted sentence must cite a source and pass `validateCitations`: no verdict or protected-trait wording, most content words present in the cited source, and every number or strength word present exactly. Removed sentences are stored and shown to the reviewer.
- The link reader opens only links the student entered, only with consent, only public `https` addresses, one page per link, and keeps specific facts.
- A summary is not searchable or exported until a recruiter approves it.

### Security notes

- Recruiters sign in with email and password (scrypt, per-secret salt). Students have no password: the device is remembered, and a one-time recovery code opens the profile elsewhere.
- Sessions are opaque random tokens in http-only, same-site cookies; only their SHA-256 is stored.
- Staff see only candidates who connected at their own event. Notes and ratings can be edited only by the recruiter who had the conversation.
- Uploaded resumes are type-checked by content, stored in the database, and served only as downloads to the owner or to staff at an event the student shared with.
- Logins, signups, uploads, profile recovery and AI calls are rate limited in the database.

### Known limits

- Student identity rests on a device cookie and a recovery code. That suits synthetic data, not a production system.
- The link reader checks an address before fetching it but does not pin the resolved IP, so it is not hardened against DNS rebinding.
- Devpost, Credly and portfolio pages are read as plain text. Only GitHub uses a structured API.
- "Statements kept" on the study page counts what passed the source check. It is not a measure of accuracy; that needs a labelled evaluation set, which is not built yet.
- Voice notes depend on the browser's speech recognition and are hidden where it is missing.
- Accessibility has been checked with axe on every screen in the browser tests. A manual screen-reader pass has not been done.
