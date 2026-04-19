import { NextResponse } from 'next/server'
import { getProject } from '@/lib/server'
import { updateProject } from '@/lib/writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = getProject(Number(id))
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(p)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await req.json()) as { name?: string; status?: string; notes?: string | null }
    updateProject(Number(id), body)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
