import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getReadDb, getWriteDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const pexec = promisify(execFile)
const OPENCLAW = process.env.OPENCLAW_CONTAINER ?? 'openclaw'

async function runNapoleon(prompt: string): Promise<string> {
  const { stdout } = await pexec(
    'docker',
    ['exec', OPENCLAW, 'bash', '-lc', `MSG=$(cat <<'EOF'
${prompt.replace(/'/g, "'\\''")}
EOF
) ; openclaw agent --agent main --message "$MSG"`],
    { timeout: 200_000, maxBuffer: 10 * 1024 * 1024 },
  )
  return stdout.trim()
}

function parseJsonLoose(s: string): any {
  const i = s.indexOf('{')
  const j = s.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  let block = s.slice(i, j + 1)
  try { return JSON.parse(block) } catch {}
  block = block.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(block) } catch { return null }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const tid = decodeURIComponent(id)
  const rdb = getReadDb()

  const thread = rdb.prepare(
    `SELECT t.*, p.name AS project_name
     FROM threads t LEFT JOIN projects p ON p.id=t.project_id
     WHERE t.id=?`,
  ).get(tid) as any
  if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 })

  const mails = rdb.prepare(
    'SELECT uid, from_email, date, subject, body_text FROM mails WHERE thread_id=? ORDER BY date ASC',
  ).all(tid) as any[]
  if (!mails.length) return NextResponse.json({ error: 'no mails' }, { status: 400 })

  const body = await req.json().catch(() => ({} as any))
  const preview: boolean = body?.preview !== false && body?.save !== true

  const mailsDump = mails
    .map((m) => {
      const text = (m.body_text || '(corpo non ancora scaricato)').toString().slice(0, 2000)
      return `--- Mail UID ${m.uid} — ${m.date} — da ${m.from_email} ---\nOggetto: ${m.subject}\n\n${text}`
    })
    .join('\n\n')

  const prompt = `Leggi il thread email qui sotto e compila una TODO LIST concreta per Giuseppe (verganiegasco.it) relativa a questo progetto.

REGOLE STRINGENTI:
- Solo task che Giuseppe deve fare (non task del cliente).
- Ogni task: breve, concreto, imperativo, 10-160 caratteri.
- Se il thread non contiene azioni per Giuseppe, ritorna tasks vuoti.
- Associa sempre il progetto "${thread.project_name ?? thread.subject_root}".
- Se identifichi una deadline esplicita nel testo, includila in formato ISO (YYYY-MM-DD) altrimenti null.

Rispondi SOLO con JSON valido in questo formato (niente altro):
{
  "summary": "breve riepilogo del thread in 1-2 frasi",
  "project_name": "${thread.project_name ?? thread.subject_root}",
  "tasks": [
    { "text": "...", "owner": "giuseppe" | "team" | "cliente", "deadline": null | "YYYY-MM-DD" }
  ]
}

Thread: ${thread.subject_root}
Cliente: ${thread.company_domain ?? '—'}
Progetto: ${thread.project_name ?? '—'}

${mailsDump}`

  let out = ''
  try {
    out = await runNapoleon(prompt)
  } catch (e: any) {
    return NextResponse.json({ error: 'napoleon timeout/error', detail: String(e?.message ?? e) }, { status: 502 })
  }

  const parsed = parseJsonLoose(out)
  if (!parsed || !Array.isArray(parsed.tasks)) {
    return NextResponse.json({ error: 'napoleon response unparseable', raw: out.slice(0, 400) }, { status: 502 })
  }

  if (preview) {
    return NextResponse.json({ preview: true, ...parsed, thread_id: tid, mail_count: mails.length })
  }

  // SAVE
  const wdb = getWriteDb()
  let projectId = thread.project_id as number | null
  if (!projectId && thread.company_domain) {
    const desired = (parsed.project_name as string) || thread.subject_root
    const existing = wdb.prepare(
      'SELECT id FROM projects WHERE client_domain=? AND lower(name)=lower(?)',
    ).get(thread.company_domain, desired) as { id: number } | undefined
    if (existing) projectId = existing.id
    else {
      const r = wdb.prepare(
        "INSERT INTO projects(client_domain, name, status) VALUES (?, ?, 'active')",
      ).run(thread.company_domain, desired)
      projectId = Number(r.lastInsertRowid)
    }
    wdb.prepare('UPDATE threads SET project_id=? WHERE id=?').run(projectId, tid)
  }

  const representativeUid = mails[mails.length - 1].uid as number
  const insert = wdb.prepare(
    `INSERT INTO todos(mail_uid, text, deadline, done, source, owner, client_domain)
     VALUES (?, ?, ?, 0, 'napoleon', ?, ?)`,
  )
  let inserted = 0
  for (const t of parsed.tasks) {
    const text = String(t.text || '').trim().slice(0, 220)
    if (text.length < 8) continue
    const owner = ['giuseppe', 'team', 'cliente', 'shared'].includes(t.owner) ? t.owner : 'giuseppe'
    insert.run(representativeUid, text, t.deadline ?? null, owner, thread.company_domain)
    inserted++
  }
  return NextResponse.json({ saved: true, inserted, project_id: projectId, summary: parsed.summary })
}
