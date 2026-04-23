import { supabase } from './supabase'

export interface ParsedAttendance {
  employee_id: string
  kw: number
  year: number
  hours: number
}

export async function parseEmail(emailText: string): Promise<ParsedAttendance[]> {
  const lines = emailText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const { kw, year } = getCurrentKW()
  const results: ParsedAttendance[] = []
  const errors: string[] = []

  for (const line of lines) {
    // Regex: surname: hours (e.g., "Varga: 40")
    const match = line.match(/^([A-Za-z\u00C4-\u017E\s]+):\s*(\d+(?:[.,]\d)?)/)

    if (!match) {
      errors.push(`Neplatný formát: "${line}"`)
      continue
    }

    const surname = match[1].trim().toLowerCase()
    const hours = parseFloat(match[2].replace(',', '.'))

    // Find employee by alias
    const { data: alias } = await supabase
      .from('employee_aliases')
      .select('employee_id')
      .eq('surname_alias', surname)
      .single()

    if (!alias) {
      errors.push(`Neznáme priezvisko: ${match[1]}`)
      continue
    }

    results.push({
      employee_id: alias.employee_id,
      kw,
      year,
      hours,
    })
  }

  if (errors.length > 0) {
    console.warn('Parser errors:', errors)
  }

  return results
}

export function getCurrentKW(): { kw: number; year: number } {
  const now = new Date()
  const year = now.getFullYear()

  // ISO week calculation
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

  return { kw: weekNum, year }
}
