import { NextResponse } from 'next/server'
import { setThreadProject } from '@/lib/writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await req.json()) as { project_id: number | null }
    setThreadProject(decodeURIComponent(id), body.project_id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
