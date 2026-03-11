# Contributing to PIN Dashboard

Thank you for your interest in contributing! This guide covers local setup, conventions, and PR workflow.

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **Supabase** project credentials (URL + anon key + service-role key)
- **Mapbox** access token (for map components)
- **OpenAI** API key (for AI insight features)
- Git and a GitHub account

## Dev Setup

```bash
git clone <repo-url> && cd Dashboard
cp .env.example .env.local   # fill in credentials
npm install
npm run dev                   # http://localhost:3000
```

See `.env.example` for the full list of required and optional environment variables.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Next.js dev server |
| `build` | `npm run build` | Production build |
| `lint` | `npm run lint` | Run ESLint |
| `typecheck` | `npm run typecheck` | Run `tsc --noEmit` |
| `test` | `npm test` | Run Vitest (single run) |
| `test:watch` | `npm run test:watch` | Run Vitest in watch mode |
| `test:coverage` | `npm run test:coverage` | Vitest with coverage report |
| `test:e2e` | `npm run test:e2e` | Run Playwright end-to-end tests |
| `analyze` | `npm run analyze` | Bundle analysis via `@next/bundle-analyzer` |
| `sbom` | `npm run sbom` | Generate CycloneDX SBOM |

## Branch Naming

Use a prefix that matches the change type:

- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation only
- `refactor/` — code restructure with no behavior change

All branches squash-merge to `main`.

## Commit Style

Use **imperative mood** with a scope when relevant. Match the existing history:

```
Add NWIS-IV real-time cache module
Fix ATTAINS blob persistence on cold start
Refactor scoring utils into shared module
```

## PR Process

1. Open a PR against `main`.
2. Fill out the template at [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).
3. Ensure CI passes (lint, typecheck, tests).
4. Request review from [`@project-pearl`](.github/CODEOWNERS) for changes under `lib/`, `app/api/admin/`, `app/api/cron/`, `lib/sentinel/`, `.github/`, or `vercel.json`.

## Pre-commit Hooks

[Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) runs automatically on commit:

- **`lib/**/*.ts`** — runs `vitest related --run` on changed files
- **`components/**/*.tsx`** — runs `vitest related --run` on changed files
- **`app/api/**/*.ts`** — runs `vitest related --run` on changed files

If a test fails, the commit is blocked. Fix the test and commit again.

## Coding Standards

### API Route Patterns

Every API route under `app/api/` should follow these conventions:

- **`export const dynamic = 'force-dynamic'`** — prevents static rendering at build time
- **`export const maxDuration`** — set to `300` for heavy cron routes, `120` for lighter ones
- **Auth check** — call `isAuthorized(request)` for user routes or `isCronAuthorized(request)` for cron routes
- **Request validation** — use `parseBody(request, schema)` from `lib/validateRequest.ts` with a Zod schema from `lib/schemas.ts`
- **Empty-data guards** — skip `set*Cache()` when fetched data has 0 records to preserve the last-known-good blob

### Cache Module Patterns

Cache modules in `lib/*Cache.ts` follow a consistent architecture:

- **Grid-based spatial indexing** at 0.1° resolution (`gridKey()` / `neighborKeys()` from `lib/cacheUtils.ts`)
- **Disk + Blob persistence** — `.cache/` directory on disk, Vercel Blob for cold-start survival
- **`ensureWarmed()`** — exported from each cache; tries disk first, then blob
- **Build locks** — `_buildInProgress` + `_buildStartedAt` with a 12-minute auto-clear timeout
- **All `set*Cache()` functions are async** — always `await` to ensure blob write completes before the response ends

### JSDoc

All exported functions and types in `lib/` should have JSDoc comments. Follow the style in `lib/cacheUtils.ts`:

- File-level `/** ... */` comment describing the module
- `@param` and `@returns` on every exported function

## Testing

- **Unit tests**: [Vitest](https://vitest.dev/) — files in `tests/unit/`
- **Integration tests**: Vitest with MSW for API mocking — files in `tests/unit/`
- **E2E tests**: [Playwright](https://playwright.dev/) — `npm run test:e2e`
- **Mock fixtures**: `tests/mocks/fixtures/` contains sample data for each cache module

Run the full suite before submitting a PR:

```bash
npm test && npm run typecheck
```

## Environment Variables

See [`.env.example`](.env.example) for the complete list. Key groups:

- **Supabase** — database and auth
- **Mapbox** — map rendering
- **OpenAI** — AI insight generation
- **Cron** — `CRON_SECRET` for cron route authentication
- **Alerts** — Resend email, Slack webhooks, Upstash rate limiting
- **Vercel Blob** — `BLOB_READ_WRITE_TOKEN` for cache persistence
- **Data sources** — API keys for CBIBS, AirNow, SAM.gov, CDC Socrata, etc.
- **Sentinel** — feature flags for the real-time event scoring engine
