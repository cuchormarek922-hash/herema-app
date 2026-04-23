import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Email webhook — receives forwarded emails from Postmark / Mailgun / SendGrid
 * and adds them to agent_queue for the Monday cron to process.
 *
 * Setup (Postmark example):
 *   Inbound domain → Webhook URL: https://your-app.vercel.app/api/agent/email-webhook
 *   Add header: X-Webhook-Secret: <WEBHOOK_SECRET>
 *
 * Add WEBHOOK_SECRET to Vercel env vars.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function extractEmailText(body: Record<string, unknown>): string | null {
  // Postmark: { TextBody: "...", HtmlBody: "..." }
  if (typeof body.TextBody === 'string' && body.TextBody.trim()) {
    return body.TextBody.trim()
  }
  // Mailgun: { 'body-plain': "..." }
  if (typeof body['body-plain'] === 'string' && (body['body-plain'] as string).trim()) {
    return (body['body-plain'] as string).trim()
  }
  // SendGrid / generic
  if (typeof body.text === 'string' && body.text.trim()) {
    return body.text.trim()
  }
  // Raw text body passed directly
  if (typeof body.emailText === 'string' && body.emailText.trim()) {
    return body.emailText.trim()
  }
  return null
}

export async function POST(request: NextRequest) {
  // Verify shared secret from header (never put secrets in URLs — they appear in logs)
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const emailText = extractEmailText(body)
  if (!emailText) {
    return NextResponse.json({ error: 'No email text found in payload' }, { status: 400 })
  }

  // Sanity check: must contain at least one "Name: hours" line
  const hasAttendanceLine = /^.+:\s*\d+/m.test(emailText)
  if (!hasAttendanceLine) {
    return NextResponse.json(
      { error: 'Email does not appear to contain attendance data (expected "Surname: hours" lines)' },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('agent_queue')
    .insert({ email_text: emailText, status: 'pending' })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    queued: true,
    jobId: data.id,
    scheduledFor: 'Monday 18:00 UTC',
    preview: emailText.slice(0, 120),
  })
}
