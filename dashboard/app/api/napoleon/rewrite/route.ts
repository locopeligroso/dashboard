import { NextResponse } from 'next/server'
import { askNapoleon } from '@/lib/napoleon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text: string; context?: string; tone?: string }
    if (!body.text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const prompt =
      `Riformula il seguente testo in italiano professionale. ` +
      (body.tone ? `Tono: ${body.tone}. ` : 'Tono cortese ma sintetico. ') +
      `Restituisci SOLO il testo riformulato, senza preamboli né la tua firma.\n\n` +
      `Testo da riformulare:\n"""\n${body.text}\n"""`
    const reply = await askNapoleon(prompt, body.context)
    return NextResponse.json({ content: reply })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
