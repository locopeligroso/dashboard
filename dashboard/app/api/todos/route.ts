import { NextResponse } from 'next/server'
import { listTodos } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.json(
    listTodos({
      openOnly: url.searchParams.get('open') !== '0',
      owner: url.searchParams.get('owner') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
      dueSoon: url.searchParams.get('dueSoon') === '1',
      recentOnly: url.searchParams.get('recent') !== '0',
      limit: Number(url.searchParams.get('limit') ?? 200),
    }),
  )
}
