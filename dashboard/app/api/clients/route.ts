import { NextResponse } from 'next/server'
import { listClients } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category') ?? undefined
  const search = url.searchParams.get('search') ?? undefined
  return NextResponse.json(listClients({ category, search }))
}
