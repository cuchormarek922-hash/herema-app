import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server'
import { parseEmail, getCurrentKW } from '@/lib/parser'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { emailText } = body

    if (!emailText) {
      return NextResponse.json({ error: 'Missing emailText' }, { status: 400 })
    }

    const parsed = await parseEmail(supabase, emailText)
    const { kw, year } = getCurrentKW()

    const { error: upsertError } = await supabase.from('weekly_attendance').upsert(
      parsed.map(p => ({
        kw: p.kw,
        year: p.year,
        employee_id: p.employee_id,
        hours: p.hours,
      })),
      { onConflict: 'kw,year,employee_id' }
    )

    if (upsertError) {
      throw new Error(`Failed to save: ${upsertError.message}`)
    }

    const { data: saved } = await supabase
      .from('weekly_attendance')
      .select('*, employees(surname, group)')
      .eq('kw', kw)
      .eq('year', year)

    return NextResponse.json({ success: true, parsed: parsed.length, saved: saved || [], kw, year })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Parse error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
