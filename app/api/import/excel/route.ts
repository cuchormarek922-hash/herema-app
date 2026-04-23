import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/** Valid employee name: starts with a letter, ≥2 chars (excludes #, numbers, blank) */
function isValidName(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const t = v.trim()
  return t.length >= 2 && /^[A-Za-zÀ-žÁ-ž]/.test(t)
}

/**
 * Extract the PRIMARY (last) KW number from a sheet name.
 * "KW5-6"  → 6  |  "KW7" → 7  |  "KW15-16" → 16  |  "kw16" → 16
 */
function sheetNameToKW(name: string): number | null {
  const m = name.toUpperCase().match(/KW\s*(\d+)(?:\s*[-–,]\s*(\d+))?/)
  if (!m) return null
  return m[2] ? parseInt(m[2]) : parseInt(m[1])
}

/**
 * Auto-detect Excel layout from first employee data row.
 *
 * OLD layout (KW6/KW7):
 *   col A(0)=name  col B(1)=SUM  col C(2)=day1 … col AE(30)=day29
 *   billing rows 57-102: col E(4)=name  col F(5)=workerRate
 *
 * NEW layout (KW8+):
 *   col A(0)=#num  col B(1)=name  col C(2)=SUM  col D(3)=day1 … col AF(31)=day29
 *   billing rows ~50-90: col F(5)=name  col G(6)=workerRate
 */
function detectLayout(data: (string | number | null)[][]): {
  nameCol: number
  dailyStart: number
  dailyEnd: number
} {
  // Look at first ~5 employee rows (indices 3-7)
  for (let r = 3; r <= 7; r++) {
    const row = data[r]
    if (!row) continue
    if (isValidName(row[0])) {
      // col A has a name → old layout
      return { nameCol: 0, dailyStart: 2, dailyEnd: 32 }
    }
    if (!isValidName(row[0]) && isValidName(row[1])) {
      // col A has a number/#, col B has a name → new layout
      return { nameCol: 1, dailyStart: 3, dailyEnd: 33 }
    }
  }
  return { nameCol: 0, dailyStart: 2, dailyEnd: 32 } // fallback: old
}

/**
 * In each billing row find worker rate (typically 22–30) immediately preceded by name.
 * Works for both layouts:
 *   Old: … col E(4)=name  col F(5)=22 …
 *   New: … col F(5)=name  col G(6)=22 …
 */
function extractRateAndName(
  row: (string | number | null)[]
): { name: string; rate: number } | null {
  for (let i = 1; i < row.length; i++) {
    const v = row[i]
    // Worker rate range 15–35 (excludes client billing rates 41/43)
    if (typeof v !== 'number' || v < 15 || v > 35) continue
    const nameCand = row[i - 1]
    if (isValidName(nameCand)) {
      return { name: (nameCand as string).trim(), rate: v }
    }
  }
  return null
}

// Cost labels to import (null = skip)
const COST_LABELS: Record<string, string | null> = {
  ubytovanie: 'Ubytovanie',
  letenky: 'Letenky',
  vca: 'VCA',
  auto: 'Auto',
  auta: 'Auto',        // variant spelling
  phm: 'PHM',
  scc: 'SCC',
  ine: 'Iné',
  provizia: null,      // commission — skip
  'nakl.celkom': null, // total — skip
  'nakl. celkom': null,
  turnover: null,
  'spolu mzdy': null,
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'Žiadny súbor' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    // Year from filename, e.g. "Herema calculation 18,03,2026.xlsx"
    const yearMatch = file.name.match(/\b(20\d{2})\b/)
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

    const employeeRates = new Map<string, number>() // fullName → worker rate
    const attendanceAcc = new Map<string, number>() // "name|kw|year" → total hours
    const costsOut: { kw: number; year: number; costType: string; amount: number }[] = []

    for (const sheetName of wb.SheetNames) {
      const primaryKW = sheetNameToKW(sheetName)
      if (primaryKW === null) continue // skip non-KW sheets (e.g. "2026 all-in")

      const ws = wb.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
        header: 1,
        defval: null,
      })

      if (data.length < 50) continue

      const { nameCol, dailyStart, dailyEnd } = detectLayout(data)

      // ── Attendance: rows 4–54 (indices 3–53) ──────────────────────────────
      let sheetTotalHours = 0

      for (let r = 3; r <= 53 && r < data.length; r++) {
        const row = data[r] as (string | number | null)[]
        if (!row) continue
        const nameRaw = row[nameCol]
        if (!isValidName(nameRaw)) continue
        const emp = (nameRaw as string).trim()

        // Sum all daily-hour columns for this KW sheet
        let hours = 0
        for (let c = dailyStart; c <= dailyEnd; c++) {
          const v = row[c]
          if (typeof v === 'number' && v > 0) hours += v
        }

        if (hours > 0) {
          const key = `${emp}|${primaryKW}|${year}`
          attendanceAcc.set(key, (attendanceAcc.get(key) || 0) + hours)
          sheetTotalHours += hours
        }
      }

      // Skip billing + costs for sheets with no real data (e.g. blank kw16 template)
      if (sheetTotalHours === 0) continue

      // ── Billing section: broad scan rows 48–105 (indices 47–104) ──────────
      // Handles both old (starts row 57) and new (starts row 50) layouts
      for (let r = 47; r <= 104 && r < data.length; r++) {
        const row = data[r] as (string | number | null)[]
        if (!row) continue
        const found = extractRateAndName(row)
        if (found) {
          employeeRates.set(found.name, found.rate)
        }
      }

      // ── Costs: broad scan rows 85–125 (indices 84–124) ────────────────────
      // Label in col A or B, amount in col C, D, or E
      for (let r = 84; r < Math.min(data.length, 125); r++) {
        const row = data[r] as (string | number | null)[]
        if (!row) continue

        // Try label in col A (0) then col B (1)
        for (const labelCol of [0, 1]) {
          const label = row[labelCol]
          if (typeof label !== 'string') continue
          const key = label.toLowerCase().trim()
          if (!(key in COST_LABELS)) continue
          const costType = COST_LABELS[key]
          if (!costType) break // explicitly skipped type

          // Try amount in cols C/D/E (indices 2, 3, 4)
          for (const amtCol of [2, 3, 4]) {
            const amt = row[amtCol]
            if (typeof amt === 'number' && amt > 0) {
              costsOut.push({ kw: primaryKW, year, costType, amount: amt })
              break
            }
          }
          break // found label, stop checking columns
        }
      }
    }

    // ── Default rate: most common rate found in billing sections ─────────────
    const rateFreq = new Map<number, number>()
    for (const r of employeeRates.values()) {
      rateFreq.set(r, (rateFreq.get(r) || 0) + 1)
    }
    let defaultRate = 22
    let maxFreq = 0
    for (const [r, freq] of rateFreq) {
      if (freq > maxFreq) { maxFreq = freq; defaultRate = r }
    }

    // ── Build output ──────────────────────────────────────────────────────────
    const empNames = new Set(
      Array.from(attendanceAcc.keys()).map((k) => k.split('|')[0])
    )

    const employees = Array.from(empNames).map((fullName) => {
      const rate = employeeRates.get(fullName) ?? defaultRate
      const parts = fullName.split(/\s+/)
      return {
        fullName,
        surname: parts[0] ?? fullName,
        firstName: parts.slice(1).join(' '),
        rate,
        group: (rate >= 25 ? 'B' : 'A') as 'A' | 'B',
      }
    })

    const attendance = Array.from(attendanceAcc.entries())
      .map(([key, hours]) => {
        const [emp, kw, yr] = key.split('|')
        return {
          employeeName: emp,
          kw: parseInt(kw),
          year: parseInt(yr),
          hours: Math.round(hours * 4) / 4,
        }
      })
      .sort((a, b) => a.kw - b.kw || a.employeeName.localeCompare(b.employeeName))

    return NextResponse.json({ year, employees, attendance, costs: costsOut })
  } catch (err) {
    console.error('Excel parse error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
