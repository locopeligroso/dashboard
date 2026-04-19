import { NextResponse } from 'next/server'
import { askNapoleon, buildContext } from '@/lib/napoleon'
import { ensureChatThread, appendMessage, updateMessage } from '@/lib/writer'
import type { EntityType } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity_type: string; entity_id: string }> },
) {
  const p = await params
  const entity_type = p.entity_type as EntityType
  const entity_id = decodeURIComponent(p.entity_id)
  try {
    const body = (await req.json()) as {
      message: string
      entity_label?: string
      client_domain?: string | null
      project_name?: string | null
      context_data?: string | null
    }
    if (!body.message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const chat = ensureChatThread(entity_type, entity_id, body.entity_label ?? null)
    const user = appendMessage(chat.id, 'user', body.message, 'ok')
    const pending = appendMessage(chat.id, 'napoleon', '', 'pending')

    const baseContext = buildContext({
      entity_type,
      entity_id,
      entity_label: body.entity_label,
      client_domain: body.client_domain ?? null,
      project_name: body.project_name ?? null,
    })
    const context = body.context_data
      ? `${baseContext}\n\n=== DATI DEL THREAD ===\n${body.context_data}`
      : baseContext

    try {
      const reply = await askNapoleon(body.message, context)
      updateMessage(pending.id, { content: reply, status: 'ok' })
      return NextResponse.json({
        chat_thread_id: chat.id,
        user_message: user,
        napoleon_message_id: pending.id,
        content: reply,
      })
    } catch (e: any) {
      const err = String(e?.message ?? e)
      updateMessage(pending.id, { status: 'error', error: err, content: `(errore: ${err})` })
      return NextResponse.json({ error: err }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
