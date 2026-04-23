# Herema Project Management App

Modern web application for managing employee hours, payroll, and project costs for Heerema.

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email + password)
- **Deployment**: Vercel + Supabase (Europe/France region)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Setup Supabase

1. Create account at https://supabase.com and create a new project (region: Europe - France)
2. Run `supabase/schema.sql` in the Supabase SQL editor
3. Optionally run `public/seed.sql` for 3 test employees and KW17 sample data
4. Create first user: **Authentication → Users → Invite**
5. Copy API keys from **Project Settings → API**

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AGENT_SECRET=          # Bearer token for /api/agent/run and /api/agent/queue
CRON_SECRET=           # Auto-set by Vercel for cron job auth
WEBHOOK_SECRET=        # Shared secret for email webhook header X-Webhook-Secret
```

### 4. Run development server

```bash
npm run dev      # localhost:3000
npm test         # run test suite
npm run lint     # ESLint
```

## Project Structure

```
app/
├── (auth)/login/       # Login page
├── dashboard/          # KPI overview
├── zamestnanci/        # Employee management
├── hodinovy-plan/      # Weekly hours planning
├── vyplaty/            # Payroll (mark as paid)
├── naklady/            # Cost entry
├── kw-report/          # Weekly reports
├── import/             # Excel import (2-step: parse → confirm)
└── api/
    ├── agent/run/          # Manual agent trigger (Bearer token)
    ├── agent/queue/        # Submit email to queue / check queue status
    ├── agent/cron/         # Vercel cron endpoint (Monday 18:00 UTC)
    ├── agent/email-webhook/# Inbound email webhook (X-Webhook-Secret header)
    ├── email-parse/        # Parse email text → upsert attendance
    ├── import/excel/       # Parse Excel file → JSON preview
    ├── import/excel/confirm/ # Persist previewed Excel data
    ├── import/aliases/     # Bulk-import employee aliases from Excel
    └── payroll/            # Mark payroll records as paid

lib/
├── supabase.ts         # Browser Supabase client (cookie sessions)
├── nameResolver.ts     # 3-layer name matching (exact → word → fuzzy)
├── parser.ts           # "Surname: hours" email format parser
├── calculations.ts     # Payroll math (0.352 fees, 1.352 total)
└── agent.ts            # Weekly agent pipeline (6 steps)

supabase/
└── schema.sql          # Full DB schema (run this first)

public/
└── seed.sql            # Test data: 3 employees, KW17 attendance + payroll + costs
```

## Features

### Employee Management
- Add/edit employees with hourly rates and groups (A = Fitter €22/h, B = Mag zvárač €23/h)
- Alias system for flexible name matching in email/Excel imports
- Soft delete (active flag)

### Attendance & Hours
- Weekly attendance tracking (KW1–KW52)
- Email-based hour entry: `Varga: 40` parsed automatically
- Excel bulk import with automatic layout detection
- Inline editing on `/hodinovy-plan`

### Payroll Calculation
- Gross salary: `hours × rate`
- Fees: `gross × 0.352` (35.2% employer contribution)
- Total cost: `gross × 1.352` — computed as GENERATED STORED columns in DB

### Costs Management
- Manual entry or Excel/CSV import per KW
- Categories: Ubytovanie, Letenky, Auto, PHM, SCC, Iné

### Weekly Agent
Automated pipeline: parse email → attendance → payroll → costs → report → logs

**Automated flow** (Monday 18:00 UTC via Vercel Cron):
1. Forward weekly email to webhook: `POST /api/agent/email-webhook` with `X-Webhook-Secret` header
2. Email is queued in `agent_queue`
3. Cron fires and processes the queue entry automatically

**Manual trigger**:
```bash
curl -X POST https://your-app.vercel.app/api/agent/queue \
  -H "Authorization: Bearer $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"emailText":"Varga: 40\nKovác: 38"}'
```

## Notes

- All UI text is in Slovak
- Currency: `1 234,56 €` (sk-SK locale)
- Dates: DD.MM.YYYY
- Cron runs at 18:00 UTC = 19:00 CET / 20:00 CEST
- Small team setup — all authenticated users see all data (RLS: `auth.role() = 'authenticated'`)
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-only, never expose to browser

## Deployment

See `DEPLOYMENT.md` for full step-by-step guide.

## License

Private project for Heerema
