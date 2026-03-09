# PIN Dashboard

Water quality intelligence platform integrating 50+ federal and state data sources into role-based dashboards for regulatory compliance, environmental monitoring, and public health.

## Architecture

- **Framework:** Next.js 15 (App Router) on Vercel
- **Auth:** Supabase (email/password, magic link, role-based access)
- **Maps:** Mapbox GL JS
- **Charts:** Recharts, ECharts
- **UI:** Radix primitives + Tailwind CSS + shadcn/ui
- **AI:** OpenAI for insights, categorization, briefing Q&A
- **Monitoring:** Sentry (error tracking), Vercel Speed Insights (RUM), Slack webhooks (cron alerts)

## Data Pipeline

52 cron jobs (defined in `vercel.json`) fetch from federal APIs on staggered schedules:

| Frequency | Sources |
|-----------|---------|
| Every 5 min | NWIS-IV (stream gauges), Sentinel |
| Every 30 min | NWS Alerts, NWPS, Air Quality, CO-OPS |
| Hourly | ATTAINS (water quality assessments) |
| Daily | WQP, ICIS, SDWIS, ECHO, FRS, FEMA, Superfund, PFAS, NDBC, SNOTEL, and more |
| Weekly | SAM.gov, USASpending, NARS, Data.gov |

All caches use grid-based spatial indexing (0.1 degree resolution) with disk + Vercel Blob persistence for cold-start survival.

## Roles

| Role | Description |
|------|-------------|
| Federal | National-scale oversight, compliance briefings, scorecards |
| State | State-level monitoring and regulatory management |
| MS4 | Municipal stormwater permit tracking |
| K-12 | Educational water quality curriculum |
| University | Research-grade data access |
| ESG | Environmental/social/governance reporting |
| PEARL Admin | Full system administration |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (for auth and data storage)
- Mapbox account (for map rendering)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd Dashboard
npm install

# Configure environment
cp .env.example .env.local
# Fill in required values (see .env.example for documentation)

# Run development server
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler check |
| `npm test` | Run unit/integration tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run sbom` | Generate CycloneDX SBOM |

## Project Structure

```
app/
  api/
    cron/           # 52 scheduled data fetchers
    admin/          # Admin management endpoints
    ai/             # AI-powered features (insights, Q&A, categorization)
    alerts/         # Alert rules, recipients, dispatch
    cache-status/   # Unified cache health endpoint
  layout.tsx        # Root layout with auth provider
components/         # React components (dashboards, maps, panels)
lib/
  *Cache.ts         # Cache modules with grid indexing
  blobPersistence.ts # Vercel Blob save/load helpers
  cacheUtils.ts     # Shared cache utilities
  cronHealth.ts     # Cron run tracking (ring buffer)
  apiAuth.ts        # API route authentication
  schemas.ts        # Zod validation schemas
  rateLimit.ts      # Upstash Redis rate limiting
  auditLog.ts       # Admin audit logging
docs/               # Compliance docs (NIST 800-53, incident response)
tests/
  unit/             # Vitest unit tests
  integration/      # API integration tests
  e2e/              # Playwright end-to-end tests
```

## Security

- SAST scanning via Semgrep (daily + on push/PR)
- Dependency auditing via `npm audit` (daily)
- CycloneDX SBOM generated on every CI run
- Rate limiting on public API routes (Upstash Redis)
- Zod validation on request bodies
- CSRF protection via middleware
- Security headers (HSTS, CSP, X-Content-Type-Options)
- Pre-commit hooks (Husky + lint-staged)
- Audit logging for admin actions
- See `docs/NIST-800-53-CONTROLS.md` for compliance mapping

## Monitoring

- **Sentry:** Client + server + edge error tracking with automatic Vercel monitors
- **Speed Insights:** Real User Monitoring for Core Web Vitals
- **Cron Health:** In-app dashboard tracking success rates, durations, and failures across all 52 cron jobs
- **Slack:** Webhook notifications on cron failures
- **Cache Status:** `/api/cache-status` endpoint for cache freshness monitoring

## Deployment

Deployed on Vercel. Cron schedules are defined in `vercel.json`. Required environment variables must be set in the Vercel project settings (see `.env.example`).
