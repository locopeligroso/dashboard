import { NextResponse } from 'next/server'
import { getClient } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const c = getClient(decodeURIComponent(domain))
  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(c)
}
