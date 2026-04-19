import { NextResponse } from 'next/server'
import { setCompanyCategory } from '@/lib/writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  try {
    const body = (await req.json()) as { category: string; notes?: string | null }
    setCompanyCategory(decodeURIComponent(domain), body.category, body.notes ?? null)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
