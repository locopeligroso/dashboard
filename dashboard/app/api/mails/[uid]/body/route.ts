import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getReadDb, getWriteDb } from '@/lib/db'
import { cleanMailText, cleanMailHtml } from '@/lib/mail-clean'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const pexec = promisify(execFile)
const OPENCLAW = process.env.OPENCLAW_CONTAINER ?? 'openclaw'

async function fetchBodyFromImap(uid: number): Promise<{ text: string; html: string }> {
  const script = `
import sys, json, email, imaplib
from html.parser import HTMLParser
env={}
for line in open('/home/node/.config/imap-smtp-email/.env'):
    line=line.strip()
    if '=' in line and not line.startswith('#'):
        k,v=line.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
M=imaplib.IMAP4_SSL(env['IMAP_HOST'], int(env.get('IMAP_PORT',993)))
M.login(env['IMAP_USER'], env['IMAP_PASS']); M.select('INBOX')
s,d=M.uid('fetch', b'${uid}', '(RFC822)')
if s!='OK' or not d or d[0] is None:
    print(json.dumps({'text':'','html':''})); sys.exit(0)
msg=email.message_from_bytes(d[0][1])
tp=[]; hp=[]
for p in msg.walk():
    if p.is_multipart(): continue
    ct=p.get_content_type()
    try:
        payload=p.get_payload(decode=True).decode(p.get_content_charset() or 'utf-8', errors='replace')
    except Exception:
        continue
    if ct=='text/plain': tp.append(payload)
    elif ct=='text/html': hp.append(payload)
class H(HTMLParser):
    def __init__(self): super().__init__(); self.buf=[]
    def handle_data(self, data): self.buf.append(data)
text='\\n\\n'.join(tp)
html='\\n'.join(hp)
if not text and html:
    h=H(); h.feed(html); text='\\n'.join(l for l in ''.join(h.buf).splitlines() if l.strip())
print(json.dumps({'text':text,'html':html}))
`
  const { stdout } = await pexec(
    'docker',
    ['exec', OPENCLAW, 'python3', '-c', script],
    { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
  )
  const parsed = JSON.parse(stdout.trim() || '{"text":"","html":""}')
  return { text: parsed.text ?? '', html: parsed.html ?? '' }
}

export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const n = Number(uid)
  if (!Number.isFinite(n)) return NextResponse.json({ error: 'invalid uid' }, { status: 400 })
  const url = new URL(req.url)
  const wantRaw = url.searchParams.get('raw') === '1'

  const rdb = getReadDb()
  const row = rdb.prepare('SELECT uid, body_text, body_html FROM mails WHERE uid=?').get(n) as
    | { uid: number; body_text: string | null; body_html: string | null }
    | undefined
  if (!row) return NextResponse.json({ error: 'mail not found' }, { status: 404 })

  async function respond(text: string, html: string, fromCache: boolean) {
    const textClean = cleanMailText(text)
    const htmlClean = cleanMailHtml(html)
    return NextResponse.json({
      uid: n,
      text: wantRaw ? text : textClean,
      html: wantRaw ? html : htmlClean,
      text_raw: text,
      html_raw: html,
      text_clean: textClean,
      html_clean: htmlClean,
      from_cache: fromCache,
    })
  }

  if (row.body_text != null || row.body_html != null) {
    return respond(row.body_text ?? '', row.body_html ?? '', true)
  }

  try {
    const { text, html } = await fetchBodyFromImap(n)
    try {
      const wdb = getWriteDb()
      wdb.prepare('UPDATE mails SET body_text=?, body_html=? WHERE uid=?').run(
        text.slice(0, 400_000),
        html.slice(0, 800_000),
        n,
      )
    } catch {}
    return respond(text, html, false)
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 })
  }
}
