import { NextResponse } from 'next/server'
import { toggleTodoDone } from '@/lib/writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const out = toggleTodoDone(Number(id))
    return NextResponse.json(out)
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
