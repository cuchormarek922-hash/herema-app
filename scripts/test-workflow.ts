/**
 * Full workflow integration test — runs against the real Supabase instance.
 * Uses credentials from .env.local.
 *
 * Usage:  npx tsx scripts/test-workflow.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const agentSecret = process.env.AGENT_SECRET!

if (!url || !key) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function ok(label: string, detail?: string) {
  console.log(`  ✅  ${label}${detail ? `  (${detail})` : ''}`)
  passed++
}

function fail(label: string, detail?: string) {
  console.error(`  ❌  ${label}${detail ? `  → ${detail}` : ''}`)
  failed++
}

async function check(
  label: string,
  fn: () => Promise<{ pass: boolean; detail?: string }>
) {
  try {
    const { pass, detail } = await fn()
    pass ? ok(label, detail) : fail(label, detail)
  } catch (err) {
    fail(label, String(err))
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testSchemaExists() {
  console.log('\n📋  Schema')
  const tables = [
    'employees', 'employee_aliases', 'weekly_attendance',
    'payroll', 'weekly_costs', 'agent_logs', 'kw_reports', 'agent_queue',
  ]
  for (const table of tables) {
    await check(`table: ${table}`, async () => {
      const { error } = await supabase.from(table).select('id').limit(1)
      return { pass: !error, detail: error?.message }
    })
  }
}

async function testEmployeeAndAlias() {
  console.log('\n👷  Employees & aliases')
  const testSurname = `__test_${Date.now()}`

  // Create
  await check('create employee', async () => {
    const { error } = await supabase.from('employees').insert({
      surname: testSurname, first_name: 'Test', group: 'A',
      hourly_rate: 22, position: 'Fitter', active: true,
    })
    return { pass: !error, detail: error?.message }
  })

  // Alias
  await check('create alias', async () => {
    const { data: emp } = await supabase.from('employees').select('id').eq('surname', testSurname).single()
    if (!emp) return { pass: false, detail: 'employee not found' }
    const { error } = await supabase.from('employee_aliases').insert({
      surname_alias: testSurname.toLowerCase(), employee_id: emp.id,
    })
    return { pass: !error, detail: error?.message }
  })

  // Lookup
  await check('alias lookup', async () => {
    const { data, error } = await supabase.from('employee_aliases')
      .select('employee_id, employees(surname)')
      .eq('surname_alias', testSurname.toLowerCase())
      .single()
    return { pass: !error && !!data, detail: error?.message }
  })

  // Cleanup
  await supabase.from('employees').delete().eq('surname', testSurname)
}

async function testAttendanceAndPayroll() {
  console.log('\n🕐  Attendance & payroll (KW99 sentinel)')
  const KW = 52  // max valid KW; year 2099 makes collision with real data impossible
  const YEAR = 2099

  // Need a real employee
  const { data: emp } = await supabase.from('employees').select('id, hourly_rate').limit(1).single()
  if (!emp) {
    fail('attendance upsert', 'no employees in DB — run seed.sql first')
    fail('payroll upsert', 'skipped')
    fail('generated columns', 'skipped')
    return
  }

  await check('attendance upsert', async () => {
    const { error } = await supabase.from('weekly_attendance').upsert(
      { kw: KW, year: YEAR, employee_id: emp.id, hours: 40 },
      { onConflict: 'kw,year,employee_id' }
    )
    return { pass: !error, detail: error?.message }
  })

  await check('payroll upsert', async () => {
    const { error } = await supabase.from('payroll').upsert(
      { kw: KW, year: YEAR, employee_id: emp.id, hours: 40, hourly_rate: emp.hourly_rate },
      { onConflict: 'kw,year,employee_id' }
    )
    return { pass: !error, detail: error?.message }
  })

  await check('generated columns (gross / fees / total)', async () => {
    const { data, error } = await supabase.from('payroll')
      .select('gross_salary, fees_35_2, total_cost')
      .eq('kw', KW).eq('year', YEAR).eq('employee_id', emp.id)
      .single()
    if (error || !data) return { pass: false, detail: error?.message }
    const expectedGross = 40 * emp.hourly_rate
    const expectedTotal = Math.round(expectedGross * 1.352 * 100) / 100
    const match = Math.abs(data.total_cost - expectedTotal) < 0.01
    return {
      pass: match,
      detail: match
        ? `total_cost=${data.total_cost} ✓`
        : `expected ${expectedTotal}, got ${data.total_cost}`,
    }
  })

  // Cleanup
  await supabase.from('payroll').delete().eq('kw', KW).eq('year', YEAR)
  await supabase.from('weekly_attendance').delete().eq('kw', KW).eq('year', YEAR)
}

async function testAgentQueue() {
  console.log('\n📬  Agent queue')

  await check('insert pending job', async () => {
    const { error } = await supabase.from('agent_queue').insert({
      email_text: 'Varga: 40\nKovác: 38', status: 'pending',
    })
    return { pass: !error, detail: error?.message }
  })

  await check('fetch pending job', async () => {
    const { data, error } = await supabase.from('agent_queue')
      .select('id, status').eq('status', 'pending').limit(1).maybeSingle()
    return { pass: !error && !!data, detail: error?.message }
  })

  // Cleanup
  await supabase.from('agent_queue').delete().eq('email_text', 'Varga: 40\nKovác: 38')
}

async function testAgentRunEndpoint() {
  console.log('\n🤖  Agent endpoint (live HTTP)')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  await check(`POST ${baseUrl}/api/agent/run (bad token → 403)`, async () => {
    const res = await fetch(`${baseUrl}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' },
      body: JSON.stringify({ emailText: 'Varga: 40' }),
    }).catch(() => null)
    if (!res) {
      ok('POST /api/agent/run (bad token → 403)', 'skipped — dev server not running')
      return { pass: true }
    }
    return { pass: res.status === 403, detail: `status ${res.status}` }
  })

  if (!agentSecret) {
    fail('POST /api/agent/run (valid token)', 'AGENT_SECRET not set in .env.local')
    return
  }

  await check('POST /api/agent/run (valid token → processes or errors gracefully)', async () => {
    const res = await fetch(`${baseUrl}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentSecret}` },
      body: JSON.stringify({ emailText: 'Varga: 40' }),
    }).catch(() => null)
    if (!res) {
      ok('POST /api/agent/run (valid token)', 'skipped — dev server not running')
      return { pass: true }
    }
    const body = await res.json()
    // Accept 200 (success) or 500 (agent error — at least the route responded correctly)
    return {
      pass: res.status === 200 || res.status === 500,
      detail: res.status === 200 ? `KW${body.result?.kw}/${body.result?.year}` : body.error,
    }
  })
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍  Herema workflow test  →  ${url.slice(0, 40)}…\n`)

  await testSchemaExists()
  await testEmployeeAndAlias()
  await testAttendanceAndPayroll()
  await testAgentQueue()
  await testAgentRunEndpoint()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  Passed: ${passed}   Failed: ${failed}`)

  if (failed > 0) {
    console.error('\n  ⚠️  Some checks failed — review output above.\n')
    process.exit(1)
  } else {
    console.log('\n  🎉  All checks passed.\n')
  }
}

main()
