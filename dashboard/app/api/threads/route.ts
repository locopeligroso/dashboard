import { NextResponse } from 'next/server'
import { listThreads } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.json(
    listThreads({
      status: url.searchParams.get('status') ?? undefined,
      clientDomain: url.searchParams.get('client') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 100),
      offset: Number(url.searchParams.get('offset') ?? 0),
    }),
  )
}
