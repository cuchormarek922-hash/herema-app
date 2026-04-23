import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runWeeklyAgent } from '@/lib/agent'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const agentSecret = process.env.AGENT_SECRET

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    // Verify Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    if (token !== agentSecret) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const body = await request.json()
    const { emailText, csvText } = body

    if (!emailText) {
      return NextResponse.json({ error: 'Missing emailText' }, { status: 400 })
    }

    const result = await runWeeklyAgent(supabase, emailText, csvText)

    // Fetch agent logs for response
    const { data: logs } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('kw', result.kw)
      .eq('year', result.year)
      .order('timestamp', { ascending: true })

    return NextResponse.json({
      success: true,
      result,
      logs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Agent error:', message)

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
