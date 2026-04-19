import { NextResponse } from 'next/server'
import { getReadDb, getWriteDb } from '@/lib/db'
import { sendMail } from '@/lib/smtp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface Incoming {
  to: string[]
  cc?: string[]
  subject: string
  text?: string
  html?: string
  attachments?: { filename: string; content_base64: string; contentType?: string }[]
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const { uid } = await params
  const n = Number(uid)
  if (!Number.isFinite(n)) return NextResponse.json({ error: 'invalid uid' }, { status: 400 })

  let body: Incoming
  try {
    body = (await req.json()) as Incoming
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!body?.to?.length) return NextResponse.json({ error: 'to[] required' }, { status: 400 })
  if (!body.subject?.trim()) return NextResponse.json({ error: 'subject required' }, { status: 400 })
  if (!body.text && !body.html) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const rdb = getReadDb()
  const orig = rdb.prepare('SELECT uid, subject, thread_id FROM mails WHERE uid=?').get(n) as
    | { uid: number; subject: string; thread_id: string | null }
    | undefined

  const attachments = (body.attachments ?? []).map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content_base64, 'base64'),
    contentType: a.contentType,
  }))

  const wdb = getWriteDb()
  const insert = wdb.prepare(
    `INSERT INTO sent_mails(in_reply_to_uid, thread_id, to_emails, cc_emails, subject, body_text, body_html, attachments_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  )
  const attMeta = (body.attachments ?? []).map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    size: Buffer.from(a.content_base64, 'base64').byteLength,
  }))
  const row = insert.run(
    n,
    orig?.thread_id ?? null,
    body.to.join(','),
    body.cc?.length ? body.cc.join(',') : null,
    body.subject,
    body.text ?? null,
    body.html ?? null,
    JSON.stringify(attMeta),
  )
  const sentId = row.lastInsertRowid as number

  try {
    const result = await sendMail({
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      text: body.text,
      html: body.html,
      attachments: attachments.length ? attachments : undefined,
    })
    wdb.prepare('UPDATE sent_mails SET status=?, message_id=? WHERE id=?').run(
      'sent',
      result.messageId ?? null,
      sentId,
    )
    return NextResponse.json({ ok: true, id: sentId, message_id: result.messageId, accepted: result.accepted })
  } catch (e: any) {
    const errMsg = String(e?.message ?? e)
    wdb.prepare('UPDATE sent_mails SET status=?, error=? WHERE id=?').run('error', errMsg, sentId)
    return NextResponse.json({ error: errMsg, id: sentId }, { status: 500 })
  }
}
