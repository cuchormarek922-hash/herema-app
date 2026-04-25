import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/server'
import { NameResolver } from '@/lib/nameResolver'

interface Employee {
  fullName: string
  surname: string
  firstName: string
  rate: number
  group: 'A' | 'B'
}
interface Attendance {
  employeeName: string
  kw: number
  year: number
  hours: number
}
interface Cost {
  kw: number
  year: number
  costType: string
  amount: number
}

/**
 * Fallback: create employee when not found via alias lookup.
 * Handles surname conflicts by appending first-name initial.
 */
async function createEmployee(supabase: SupabaseClient, emp: Employee): Promise<string | null> {
  const { surname, firstName, rate, group } = emp

  // Check for surname conflict
  const { data: conflict } = await supabase
    .from('employees')
    .select('id, first_name')
    .eq('surname', surname)
    .maybeSingle()

  let useSurname = surname
  if (conflict) {
    // Existing employee has same surname but different firstName → disambiguate
    if ((conflict.first_name ?? '').toLowerCase() !== firstName.toLowerCase()) {
      const initial = firstName.charAt(0).toUpperCase()
      useSurname = `${surname} ${initial}`
    } else {
      // Same person — just return existing id and update rate
      await supabase
        .from('employees')
        .update({ hourly_rate: rate, group })
        .eq('id', conflict.id)
      return conflict.id
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .upsert(
      { surname: useSurname, first_name: firstName, group, hourly_rate: rate, position: 'Worker', active: true },
      { onConflict: 'surname' }
    )
    .select('id')
    .single()

  if (error || !data) return null

  // Create alias for this new employee
  await supabase
    .from('employee_aliases')
    .upsert(
      { surname_alias: useSurname.toLowerCase(), employee_id: data.id },
      { onConflict: 'surname_alias' }
    )

  return data.id
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await (await createServerClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { employees, attendance, costs } = (await request.json()) as {
      employees: Employee[]
      attendance: Attendance[]
      costs: Cost[]
    }

    let empCount = 0
    let attCount = 0
    let costCount = 0
    const errors: string[] = []
    const resolvedBy: Record<string, string> = {} // fullName → resolution method

    // ── Load alias resolver ────────────────────────────────────────────────
    const resolver = new NameResolver()
    await resolver.load(supabase)

    // ── 1. Resolve employees ───────────────────────────────────────────────
    const empIdMap = new Map<string, string>() // fullName → employee_id

    for (const emp of employees) {
      // Layer 1-3: Smart name resolver (alias table + fuzzy)
      const resolved = resolver.resolve(emp.fullName)

      if (resolved) {
        empIdMap.set(emp.fullName, resolved.employeeId)
        resolvedBy[emp.fullName] = resolved.method
        // Update rate if billing section gave us better data
        await supabase
          .from('employees')
          .update({ hourly_rate: emp.rate, group: emp.group })
          .eq('id', resolved.employeeId)
        empCount++
      } else {
        // Fallback: create new employee
        const id = await createEmployee(supabase, emp)
        if (id) {
          empIdMap.set(emp.fullName, id)
          resolvedBy[emp.fullName] = 'created'
          empCount++
        } else {
          errors.push(`Nepodarilo sa vytvoriť zamestnanca: ${emp.fullName}`)
        }
      }
    }

    // ── 2. Upsert attendance + payroll ─────────────────────────────────────
    for (const att of attendance) {
      const empId = empIdMap.get(att.employeeName)
      if (!empId) {
        errors.push(`Nenájdený ID pre: ${att.employeeName}`)
        continue
      }

      const emp = employees.find((e) => e.fullName === att.employeeName)
      const rate = emp?.rate ?? 22

      const { error: attErr } = await supabase
        .from('weekly_attendance')
        .upsert(
          { kw: att.kw, year: att.year, employee_id: empId, hours: att.hours },
          { onConflict: 'kw,year,employee_id' }
        )

      if (attErr) {
        errors.push(`Dochádzka KW${att.kw} ${att.employeeName}: ${attErr.message}`)
        continue
      }

      await supabase
        .from('payroll')
        .upsert(
          { kw: att.kw, year: att.year, employee_id: empId, hours: att.hours, hourly_rate: rate },
          { onConflict: 'kw,year,employee_id' }
        )

      attCount++
    }

    // ── 3. Upsert costs ────────────────────────────────────────────────────
    for (const cost of costs) {
      const { error } = await supabase
        .from('weekly_costs')
        .upsert(
          { kw: cost.kw, year: cost.year, cost_type: cost.costType, amount: cost.amount, source: 'Excel Import' },
          { onConflict: 'kw,year,cost_type' }
        )
      if (!error) costCount++
    }

    return NextResponse.json({
      employees: empCount,
      attendance: attCount,
      costs: costCount,
      resolvedBy,
      errors,
      aliasesLoaded: resolver.size,
    })
  } catch (err) {
    console.error('Import confirm error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
