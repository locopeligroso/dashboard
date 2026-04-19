import { NextResponse } from 'next/server'
import { getChat } from '@/lib/server'
import type { EntityType } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entity_type: string; entity_id: string }> },
) {
  const p = await params
  const chat = getChat(p.entity_type as EntityType, decodeURIComponent(p.entity_id))
  return NextResponse.json(chat ?? { id: null, messages: [] })
}
