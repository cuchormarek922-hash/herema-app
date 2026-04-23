import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseEmail } from '@/lib/parser'
import { getCurrentKW } from '@/lib/parser'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  try {
    const body = await request.json()
    const { emailText } = body

    if (!emailText) {
      return NextResponse.json({ error: 'Missing emailText' }, { status: 400 })
    }

    const parsed = await parseEmail(emailText)
    const { kw, year } = getCurrentKW()

    // Upsert to database
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

    // Fetch saved records with employee data
    const { data: saved } = await supabase
      .from('weekly_attendance')
      .select('*, employees(surname, group)')
      .eq('kw', kw)
      .eq('year', year)

    return NextResponse.json({
      success: true,
      parsed: parsed.length,
      saved: saved || [],
      kw,
      year,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Parse error:', message)

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
