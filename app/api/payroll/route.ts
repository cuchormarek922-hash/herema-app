import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const body = await request.json()
    const { action, payrollIds } = body

    if (action === 'mark-paid') {
      if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
        return NextResponse.json({ error: 'Missing payrollIds' }, { status: 400 })
      }

      const { error } = await supabase
        .from('payroll')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .in('id', payrollIds)

      if (error) {
        throw new Error(`Failed to update payroll: ${error.message}`)
      }

      return NextResponse.json({
        success: true,
        updated: payrollIds.length,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Payroll error:', message)

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
