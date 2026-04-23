# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Development server at localhost:3000
npm run build             # Production build
npm run lint              # ESLint checks
npm test                  # Unit tests (Vitest, no DB needed)
npm run test:integration  # Integration test against live Supabase (reads .env.local)
```

## Architecture Overview

**Herema-app** is a Next.js 14 (App Router) payroll and cost management system for a small construction team (~10 people). Two employee groups: A (Fitter, €22/h) and B (Mag zvárač, €23/h). All UI text is in Slovak.

### Database (Supabase PostgreSQL)

Seven tables — run `supabase/schema.sql` in the Supabase SQL editor to set up:

| Table | Purpose |
|---|---|
| `employees` | Master list; UNIQUE on `surname`; `group` ∈ {A, B} |
| `employee_aliases` | Normalized name variants → employee_id; UNIQUE on `surname_alias` |
| `weekly_attendance` | Hours per employee per KW; UNIQUE(kw, year, employee_id) |
| `payroll` | Salary records; `gross_salary`, `fees_35_2`, `total_cost` are GENERATED STORED columns |
| `weekly_costs` | Operational costs by type; UNIQUE(kw, year, cost_type) |
| `agent_logs` | Audit trail for the weekly agent pipeline |
| `kw_reports` | Aggregated weekly reports (JSONB full_data) |

RLS is enabled on all tables; policy: `auth.role() = 'authenticated'` — all authenticated users see all data.

**Payroll math constants** (in `lib/calculations.ts`):
- Fee coefficient: `0.352`
- Total cost multiplier: `1.352` (= gross × 1.352)

### Name Resolver (`lib/nameResolver.ts`)

The core of the import system. Maps raw name strings (from emails or Excel) to `employee_id` using three layers:

1. **Exact**: Normalize → lowercase + strip diacritics + punctuation→space → lookup in `employee_aliases`
2. **Word**: Split on spaces, try each word ≥3 chars longest-first
3. **Fuzzy**: Levenshtein distance ≤2 (≤1 for names ≤5 chars)

`normalizeName()` is also exported for use in alias import routes. Always load the resolver once with `await resolver.load(supabase)` before resolving multiple names.

### Key lib/ Files

- **`lib/nameResolver.ts`** — `NameResolver` class + `normalizeName()` + `levenshtein()`
- **`lib/agent.ts`** — `runWeeklyAgent()`: 6-step pipeline (parse → attendance → payroll → costs → report → logs)
- **`lib/calculations.ts`** — payroll math, `formatCurrency()` (sk-SK locale, EUR), `getWeekDates()`, `getCurrentKW()`
- **`lib/parser.ts`** — `parseEmail()` regex parser for "Surname: hours" email format; also exports `getCurrentKW()`
- **`lib/supabase.ts`** — Supabase client via `createClientComponentClient()` (cookie-based sessions)

### API Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/email-parse` | session | Parse email text → upsert `weekly_attendance` |
| `POST /api/agent/run` | Bearer `AGENT_SECRET` | Full weekly agent pipeline |
| `POST /api/import/excel` | session | Parse uploaded Excel → return JSON preview |
| `POST /api/import/excel/confirm` | session | Persist previewed data to DB |
| `POST /api/import/aliases` | session | Bulk-import employee aliases from Excel |
| `POST /api/payroll` | session | Mark payroll records as paid |
| `POST /api/auth/logout` | session | Sign out |

**Excel import is two-step**: parse first (returns preview), then confirm (persists). The parser detects sheet layout automatically (old vs. new Excel format) and extracts employees, rates, attendance, and costs.

**Alias import Excel columns**: `Alias_z_Emailu`, `Oficiálne_Meno`, `ID_Zamestnanca`. When a surname conflict exists, appends first-name initial (e.g., "Apostol M").

### Authentication

`middleware.ts` uses `createMiddlewareClient` (Supabase auth-helpers). Public paths: `/login`, `/set-password`, `/auth/*`, `/api/auth/*`. All other routes require an active session.

Supabase client for server-side API routes uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Browser client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` with cookie-based sessions.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AGENT_SECRET=          # Bearer token for /api/agent/run
```

### Path Alias

`@/*` maps to the project root (configured in `tsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.

## Deployment

**Stack**: Vercel (frontend + API routes) + Supabase (PostgreSQL, Auth). Supabase region: Europe (France).

**First-time setup order**:
1. Run `supabase/schema.sql` in Supabase SQL editor
2. Optionally run `public/seed.sql` for 3 test employees + sample data
3. Set all 4 env vars in Vercel → Settings → Environment Variables
4. Create users via Supabase → Authentication → Users → Invite (no self-registration)

**Agent trigger** (manual, no cron scheduled yet):
```bash
curl -X POST https://<your-app>.vercel.app/api/agent/run \
  -H "Authorization: Bearer $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"emailText":"Varga: 40\nKovác: 38"}'
```

Git push to `main` triggers automatic Vercel redeploy. If build fails, run `npm run build` locally first to catch errors.
