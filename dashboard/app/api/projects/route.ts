import { NextResponse } from 'next/server'
import { listProjects } from '@/lib/server'
import { createProject } from '@/lib/writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.json(
    listProjects({
      clientDomain: url.searchParams.get('client') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    }),
  )
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { client_domain: string; name: string; notes?: string }
    if (!body.client_domain || !body.name) return NextResponse.json({ error: 'client_domain and name required' }, { status: 400 })
    return NextResponse.json(createProject(body.client_domain, body.name, body.notes))
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
