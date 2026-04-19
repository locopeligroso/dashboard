import 'server-only'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import { randomBytes } from 'crypto'
import path from 'path'
import { tmpdir } from 'os'

const pexec = promisify(execFile)
const OPENCLAW_CONTAINER = process.env.OPENCLAW_CONTAINER ?? 'openclaw'
const TIMEOUT_MS = Number(process.env.NAPOLEON_TIMEOUT_MS ?? 180_000)

export async function askNapoleon(prompt: string, context?: string): Promise<string> {
  const full = context ? `Context:\n${context}\n\n---\n\nUser:\n${prompt}` : prompt
  const token = randomBytes(8).toString('hex')
  const hostTmp = path.join(tmpdir(), `np-${token}.txt`)
  await fs.writeFile(hostTmp, full, 'utf8')
  try {
    await pexec('docker', ['cp', hostTmp, `${OPENCLAW_CONTAINER}:/tmp/np-${token}.txt`], { timeout: 15_000 })
    const { stdout } = await pexec(
      'docker',
      [
        'exec',
        OPENCLAW_CONTAINER,
        'bash',
        '-lc',
        `MSG=$(cat /tmp/np-${token}.txt); openclaw agent --agent main --message "$MSG"`,
      ],
      { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    )
    return stdout.trim() || '(Napoleone non ha risposto.)'
  } finally {
    try { await fs.unlink(hostTmp) } catch {}
    try {
      await pexec('docker', ['exec', OPENCLAW_CONTAINER, 'rm', '-f', `/tmp/np-${token}.txt`], { timeout: 5_000 })
    } catch {}
  }
}

export function buildContext(payload: {
  entity_type: string
  entity_id: string
  entity_label?: string
  client_domain?: string | null
  project_name?: string | null
}): string {
  const lines: string[] = []
  lines.push(`Dashboard CRM — conversazione contestualizzata`)
  lines.push(`Entità: ${payload.entity_type} (id=${payload.entity_id})`)
  if (payload.entity_label) lines.push(`Etichetta: ${payload.entity_label}`)
  if (payload.client_domain) lines.push(`Cliente: ${payload.client_domain}`)
  if (payload.project_name) lines.push(`Progetto: ${payload.project_name}`)
  lines.push(
    `\nHai accesso al database mail-db.sqlite e a tutti gli strumenti del workspace. Rispondi operativamente in italiano, mantieni lo stile marescialleo con firma ⚜.`,
  )
  return lines.join('\n')
}
