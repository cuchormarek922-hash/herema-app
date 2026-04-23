import { SupabaseClient } from '@supabase/supabase-js'
import { parseEmail, getCurrentKW } from './parser'

interface ParsedCSVCost {
  cost_type: string
  amount: number
}

function parseCSV(csvText: string): ParsedCSVCost[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  const results: ParsedCSVCost[] = []

  for (const line of lines) {
    const [costType, amountStr] = line.split(',').map(s => s.trim())
    if (costType && amountStr) {
      results.push({
        cost_type: costType,
        amount: parseFloat(amountStr.replace(',', '.')),
      })
    }
  }

  return results
}

async function logAgentEvent(
  supabase: SupabaseClient,
  kw: number,
  year: number,
  step: string,
  status: 'ok' | 'warning' | 'error',
  message: string,
  data?: Record<string, any>
) {
  const { error } = await supabase.from('agent_logs').insert({
    kw,
    year,
    step,
    status,
    message,
    data: data || null,
  })

  if (error) {
    console.error('Agent log error:', error)
  }
}

export async function runWeeklyAgent(
  supabase: SupabaseClient,
  emailText: string,
  csvText?: string
) {
  const { kw, year } = getCurrentKW()

  try {
    await logAgentEvent(supabase, kw, year, 'START', 'ok', `Starting agent for KW${kw}/${year}`)

    // Step 1: Parse email
    const parsed = await parseEmail(emailText)
    await logAgentEvent(supabase, kw, year, 'email_parse', 'ok', `Parsed ${parsed.length} employees`, {
      count: parsed.length,
    })

    // Step 2: Upsert attendance
    for (const record of parsed) {
      const { error } = await supabase.from('weekly_attendance').upsert(
        {
          kw: record.kw,
          year: record.year,
          employee_id: record.employee_id,
          hours: record.hours,
        },
        { onConflict: 'kw,year,employee_id' }
      )

      if (error) {
        throw new Error(`Failed to upsert attendance: ${error.message}`)
      }
    }
    await logAgentEvent(supabase, kw, year, 'attendance_upsert', 'ok', `${parsed.length} records updated`)

    // Step 3: Fetch attendance with employee rates
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('weekly_attendance')
      .select('*, employees(id, hourly_rate)')
      .eq('kw', kw)
      .eq('year', year)

    if (attendanceError) {
      throw new Error(`Failed to fetch attendance: ${attendanceError.message}`)
    }

    // Step 4: Upsert payroll
    const payrollRecords = attendanceData.map((record: any) => ({
      kw,
      year,
      employee_id: record.employee_id,
      hours: record.hours,
      hourly_rate: record.employees.hourly_rate,
    }))

    for (const payroll of payrollRecords) {
      const { error } = await supabase.from('payroll').upsert(
        payroll,
        { onConflict: 'kw,year,employee_id' }
      )

      if (error) {
        throw new Error(`Failed to upsert payroll: ${error.message}`)
      }
    }
    await logAgentEvent(supabase, kw, year, 'payroll_calc', 'ok', `Payroll calculated for ${payrollRecords.length} employees`)

    // Step 5: Import costs (if provided)
    if (csvText) {
      const costs = parseCSV(csvText)

      for (const cost of costs) {
        const { error } = await supabase.from('weekly_costs').upsert(
          {
            kw,
            year,
            cost_type: cost.cost_type,
            amount: cost.amount,
            source: 'CSV',
          },
          { onConflict: 'kw,year,cost_type' }
        )

        if (error) {
          throw new Error(`Failed to upsert costs: ${error.message}`)
        }
      }
      await logAgentEvent(supabase, kw, year, 'costs_import', 'ok', `${costs.length} cost items imported`)
    }

    // Step 6: Generate report
    const { data: payrollData } = await supabase
      .from('payroll')
      .select('total_cost, hours')
      .eq('kw', kw)
      .eq('year', year)

    const { data: costsData } = await supabase
      .from('weekly_costs')
      .select('amount')
      .eq('kw', kw)
      .eq('year', year)

    const totalHours = payrollData?.reduce((sum, p) => sum + (p.hours || 0), 0) || 0
    const totalLaborCost = payrollData?.reduce((sum, p) => sum + (p.total_cost || 0), 0) || 0
    const totalOtherCosts = costsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
    const totalAllCosts = totalLaborCost + totalOtherCosts

    const { error: reportError } = await supabase.from('kw_reports').upsert(
      {
        kw,
        year,
        total_hours: totalHours,
        total_labor_cost: totalLaborCost,
        total_other_costs: totalOtherCosts,
        total_all_costs: totalAllCosts,
        full_data: {
          payroll: payrollData,
          costs: costsData,
        },
      },
      { onConflict: 'kw,year' }
    )

    if (reportError) {
      throw new Error(`Failed to create report: ${reportError.message}`)
    }
    await logAgentEvent(supabase, kw, year, 'report_gen', 'ok', 'KW report generated')

    await logAgentEvent(supabase, kw, year, 'DONE', 'ok', `Agent completed successfully`)

    return {
      success: true,
      message: `Agent completed for KW${kw}/${year}`,
      kw,
      year,
      parsed: parsed.length,
      payroll: payrollRecords.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logAgentEvent(supabase, kw, year, 'ERROR', 'error', errorMessage)
    throw error
  }
}
