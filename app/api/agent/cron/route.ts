import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runWeeklyAgent } from '@/lib/agent'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  // Vercel injects CRON_SECRET automatically — verify it to block external callers
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the oldest unprocessed queue entry
  const { data: job, error: fetchError } = await supabase
    .from('agent_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({ skipped: true, reason: 'No pending job in queue' })
  }

  // Mark as processing to prevent duplicate runs
  await supabase
    .from('agent_queue')
    .update({ status: 'processing' })
    .eq('id', job.id)

  try {
    const result = await runWeeklyAgent(supabase, job.email_text, job.csv_text ?? undefined)

    await supabase
      .from('agent_queue')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('id', job.id)

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await supabase
      .from('agent_queue')
      .update({ status: 'error', error_message: message })
      .eq('id', job.id)

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
