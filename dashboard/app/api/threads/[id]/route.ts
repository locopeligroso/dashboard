import { NextResponse } from 'next/server'
import { getThread } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = getThread(decodeURIComponent(id))
  if (!d) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(d)
}
