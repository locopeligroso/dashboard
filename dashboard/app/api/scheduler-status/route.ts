import { NextResponse } from 'next/server'
import { schedulerStatus } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(schedulerStatus())
}
