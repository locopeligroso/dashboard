import { NextResponse } from 'next/server'
import { listAttachments } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.json(
    listAttachments({
      mime: url.searchParams.get('mime') ?? undefined,
      clientDomain: url.searchParams.get('client') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 300),
    }),
  )
}
