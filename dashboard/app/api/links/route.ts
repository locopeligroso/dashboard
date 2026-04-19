import { NextResponse } from 'next/server'
import { listLinks, topLinkDomains } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('top') === '1') {
    return NextResponse.json(topLinkDomains(Number(url.searchParams.get('limit') ?? 10)))
  }
  return NextResponse.json(
    listLinks({
      domain: url.searchParams.get('domain') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 200),
    }),
  )
}
