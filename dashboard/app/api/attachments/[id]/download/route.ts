import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { getAttachment } from '@/lib/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const a = getAttachment(Number(id))
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Remap the container path (where mail-index.py wrote it) to the dashboard mount.
  // In openclaw: /home/node/.openclaw/workspace/mail-attachments/...
  // In dashboard: /openclaw-data/workspace/mail-attachments/...
  const local = (a.path ?? '').replace(
    '/home/node/.openclaw/workspace/',
    '/openclaw-data/workspace/',
  )
  try {
    const buf = await fs.readFile(local)
    const url = new URL(req.url)
    const inline = url.searchParams.get('inline') === '1'
    const disp = inline ? 'inline' : 'attachment'
    const filename = encodeURIComponent(a.filename)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': a.mime || 'application/octet-stream',
        'Content-Length': String(buf.byteLength),
        'Content-Disposition': `${disp}; filename*=UTF-8''${filename}`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: `file not found: ${e?.message ?? e}`, path: local }, { status: 404 })
  }
}
