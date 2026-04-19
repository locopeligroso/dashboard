import 'server-only'
import { getReadDb } from './db'
import type {
  Attachment,
  AttachmentsByThread,
  Category,
  ChatMessage,
  ChatThread,
  ClientDetail,
  ClientSummary,
  EntityType,
  Kpi,
  Link,
  Mail,
  Person,
  Project,
  ProjectDetail,
  Run,
  SchedulerStatus,
  Thread,
  ThreadDetail,
  Todo,
  TopDomain,
} from './types'

const DAYS_14 = "date('now', '-14 days')"

export function getKpi(): Kpi {
  const db = getReadDb()
  const scalar = (q: string) => (db.prepare(q).pluck().get() as number) ?? 0
  const mails = scalar('SELECT COUNT(*) FROM mails')
  const threads = scalar('SELECT COUNT(*) FROM threads')
  const threadsOpen = scalar(`SELECT COUNT(*) FROM threads WHERE last_msg_date >= ${DAYS_14}`)
  const attachments = scalar('SELECT COUNT(*) FROM attachments')
  const links = scalar('SELECT COUNT(*) FROM links')
  const activeClients = scalar(
    `SELECT COUNT(DISTINCT t.company_domain)
     FROM threads t JOIN company_categories cc ON cc.domain=t.company_domain
     WHERE cc.category='client' AND t.last_msg_date >= ${DAYS_14}`,
  )
  const activeProjects = scalar(
    `SELECT COUNT(DISTINCT p.id) FROM projects p
     JOIN threads t ON t.project_id=p.id
     WHERE p.status='active' AND t.last_msg_date >= ${DAYS_14}`,
  )
  const todosOpen = scalar(
    `SELECT COUNT(*) FROM todos tt
     JOIN mails m ON m.uid=tt.mail_uid
     LEFT JOIN company_categories cc ON cc.domain=tt.client_domain
     WHERE tt.done=0 AND m.date >= ${DAYS_14}
       AND (cc.category='client' OR tt.client_domain IS NULL)`,
  )
  const lastRun = (db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').get() as Run | undefined) ?? null
  return {
    mails, threads, threads_open: threadsOpen, todos_open: todosOpen,
    attachments, links, active_clients: activeClients, active_projects: activeProjects, last_run: lastRun,
  }
}

export function listClients(opts: { category?: string; search?: string } = {}): ClientSummary[] {
  const db = getReadDb()
  const clauses: string[] = []
  const params: Record<string, any> = {}
  if (opts.category && opts.category !== 'all') {
    clauses.push("COALESCE(cc.category,'unknown') = @category")
    params.category = opts.category
  }
  if (opts.search) {
    clauses.push("(c.domain LIKE @q OR COALESCE(c.name,'') LIKE @q)")
    params.q = `%${opts.search}%`
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
  const sql = `
    SELECT c.domain, c.name,
           COALESCE(cc.category,'unknown') AS category,
           c.email_count,
           COALESCE(t.thread_count, 0) AS thread_count,
           COALESCE(t.open_threads, 0) AS open_threads,
           c.last_seen,
           COALESCE(pc.project_count, 0) AS project_count
    FROM companies c
    LEFT JOIN company_categories cc ON cc.domain=c.domain
    LEFT JOIN (
      SELECT company_domain AS domain, COUNT(*) AS thread_count,
             SUM(CASE WHEN last_msg_date >= ${DAYS_14} THEN 1 ELSE 0 END) AS open_threads
      FROM threads GROUP BY company_domain
    ) t ON t.domain=c.domain
    LEFT JOIN (SELECT client_domain AS domain, COUNT(*) AS project_count FROM projects GROUP BY client_domain) pc ON pc.domain=c.domain
    ${where}
    ORDER BY open_threads DESC, c.email_count DESC, c.last_seen DESC
    LIMIT 500
  `
  return db.prepare(sql).all(params) as ClientSummary[]
}

export function getClient(domain: string): ClientDetail | null {
  const db = getReadDb()
  const summary = db.prepare(
    `SELECT c.domain, c.name, COALESCE(cc.category,'unknown') AS category,
            c.email_count, COALESCE(t.thread_count, 0) AS thread_count,
            COALESCE(t.open_threads, 0) AS open_threads, c.last_seen,
            COALESCE(pc.project_count, 0) AS project_count
     FROM companies c
     LEFT JOIN company_categories cc ON cc.domain=c.domain
     LEFT JOIN (
       SELECT company_domain AS domain, COUNT(*) AS thread_count,
              SUM(CASE WHEN last_msg_date >= ${DAYS_14} THEN 1 ELSE 0 END) AS open_threads
       FROM threads GROUP BY company_domain
     ) t ON t.domain=c.domain
     LEFT JOIN (SELECT client_domain AS domain, COUNT(*) AS project_count FROM projects GROUP BY client_domain) pc ON pc.domain=c.domain
     WHERE c.domain=?`,
  ).get(domain) as ClientSummary | undefined
  if (!summary) return null

  const threads = db.prepare(
    `SELECT t.*, p.name AS project_name FROM threads t
     LEFT JOIN projects p ON p.id=t.project_id
     WHERE t.company_domain=? ORDER BY t.last_msg_date DESC LIMIT 200`,
  ).all(domain) as Thread[]

  const todos = db.prepare(
    `SELECT tt.*, m.date as mail_date, m.subject as mail_subject,
            COALESCE(cc.category,'unknown') as category,
            t.project_id, p.name AS project_name
     FROM todos tt
     JOIN mails m ON m.uid=tt.mail_uid
     LEFT JOIN threads t ON t.id=m.thread_id
     LEFT JOIN projects p ON p.id=t.project_id
     LEFT JOIN company_categories cc ON cc.domain=tt.client_domain
     WHERE tt.client_domain=?
     ORDER BY tt.done, m.date DESC LIMIT 200`,
  ).all(domain) as Todo[]

  const attachments = db.prepare(
    `SELECT a.*, m.subject as mail_subject, m.date as mail_date, m.from_email,
            t.company_domain as client_domain, t.id as thread_id, t.project_id,
            COALESCE(cc.category,'unknown') as category
     FROM attachments a
     JOIN mails m ON m.uid=a.mail_uid
     LEFT JOIN threads t ON t.id=m.thread_id
     LEFT JOIN company_categories cc ON cc.domain=t.company_domain
     WHERE t.company_domain=? ORDER BY m.date DESC LIMIT 300`,
  ).all(domain) as Attachment[]

  const links = db.prepare(
    `SELECT l.*, m.subject as mail_subject, m.date as mail_date,
            t.company_domain as client_domain,
            COALESCE(cc.category,'unknown') as category
     FROM links l JOIN mails m ON m.uid=l.mail_uid
     LEFT JOIN threads t ON t.id=m.thread_id
     LEFT JOIN company_categories cc ON cc.domain=t.company_domain
     WHERE t.company_domain=? ORDER BY m.date DESC LIMIT 300`,
  ).all(domain) as Link[]

  const people = db.prepare(
    `SELECT email, name, company_domain, email_count, last_seen
     FROM people WHERE company_domain=? ORDER BY email_count DESC LIMIT 50`,
  ).all(domain) as Person[]

  const projects = db.prepare(
    `SELECT p.*,
            COUNT(DISTINCT t.id) AS thread_count,
            COUNT(DISTINCT CASE WHEN td.done=0 THEN td.id END) AS todo_open_count,
            MAX(t.last_msg_date) AS last_activity
     FROM projects p
     LEFT JOIN threads t ON t.project_id = p.id
     LEFT JOIN todos td ON td.mail_uid IN (SELECT uid FROM mails WHERE thread_id = t.id)
     WHERE p.client_domain=?
     GROUP BY p.id
     ORDER BY last_activity DESC`,
  ).all(domain) as Project[]

  return { ...summary, threads, todos, attachments, links, people, projects }
}

// PROJECTS
export function listProjects(opts: { clientDomain?: string; status?: string } = {}): Project[] {
  const db = getReadDb()
  const where: string[] = []
  const params: Record<string, any> = {}
  if (opts.clientDomain) { where.push('p.client_domain = @domain'); params.domain = opts.clientDomain }
  if (opts.status) { where.push('p.status = @status'); params.status = opts.status }
  const sql = `
    SELECT p.*,
           c.name AS client_name,
           COALESCE(cc.category,'unknown') AS client_category,
           COUNT(DISTINCT t.id) AS thread_count,
           COUNT(DISTINCT CASE WHEN td.done=0 THEN td.id END) AS todo_open_count,
           MAX(t.last_msg_date) AS last_activity
    FROM projects p
    LEFT JOIN companies c ON c.domain=p.client_domain
    LEFT JOIN company_categories cc ON cc.domain=p.client_domain
    LEFT JOIN threads t ON t.project_id = p.id
    LEFT JOIN todos td ON td.mail_uid IN (SELECT uid FROM mails WHERE thread_id = t.id)
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY p.id
    ORDER BY last_activity DESC
  `
  return db.prepare(sql).all(params) as Project[]
}

export function getProject(id: number): ProjectDetail | null {
  const db = getReadDb()
  const p = db.prepare(
    `SELECT p.*, c.name AS client_name, COALESCE(cc.category,'unknown') AS client_category
     FROM projects p
     LEFT JOIN companies c ON c.domain=p.client_domain
     LEFT JOIN company_categories cc ON cc.domain=p.client_domain
     WHERE p.id=?`,
  ).get(id) as Project | undefined
  if (!p) return null
  const threads = db.prepare(
    'SELECT * FROM threads WHERE project_id=? ORDER BY last_msg_date DESC',
  ).all(id) as Thread[]
  const todos = db.prepare(
    `SELECT tt.*, m.date as mail_date, m.subject as mail_subject, 'client' as category
     FROM todos tt
     JOIN mails m ON m.uid=tt.mail_uid
     JOIN threads t ON t.id=m.thread_id
     WHERE t.project_id=? ORDER BY tt.done, m.date DESC LIMIT 300`,
  ).all(id) as Todo[]
  const attachments = db.prepare(
    `SELECT a.*, m.subject as mail_subject, m.date as mail_date, m.from_email,
            t.company_domain as client_domain, t.id as thread_id, t.project_id
     FROM attachments a JOIN mails m ON m.uid=a.mail_uid
     JOIN threads t ON t.id=m.thread_id
     WHERE t.project_id=? ORDER BY m.date DESC LIMIT 300`,
  ).all(id) as Attachment[]
  const links = db.prepare(
    `SELECT l.*, m.subject as mail_subject, m.date as mail_date,
            t.company_domain as client_domain
     FROM links l JOIN mails m ON m.uid=l.mail_uid
     JOIN threads t ON t.id=m.thread_id
     WHERE t.project_id=? ORDER BY m.date DESC LIMIT 300`,
  ).all(id) as Link[]

  const client = db.prepare(
    `SELECT c.domain, c.name, COALESCE(cc.category,'unknown') AS category,
            c.email_count, c.last_seen, 0 AS thread_count, 0 AS open_threads
     FROM companies c LEFT JOIN company_categories cc ON cc.domain=c.domain
     WHERE c.domain=?`,
  ).get(p.client_domain) as ClientSummary | undefined

  return { ...p, client: client ?? null, threads, todos, attachments, links }
}

// THREADS
export function listThreads(opts: {
  status?: string; clientDomain?: string; category?: string; projectId?: number;
  limit?: number; offset?: number;
} = {}): Thread[] {
  const db = getReadDb()
  const where: string[] = []
  const params: Record<string, any> = {}
  if (opts.status) { where.push('t.status = @status'); params.status = opts.status }
  if (opts.clientDomain) { where.push('t.company_domain = @domain'); params.domain = opts.clientDomain }
  if (opts.category && opts.category !== 'all') {
    where.push("COALESCE(cc.category,'unknown') = @category"); params.category = opts.category
  }
  if (opts.projectId != null) { where.push('t.project_id = @project'); params.project = opts.projectId }
  params.limit = opts.limit ?? 200
  params.offset = opts.offset ?? 0
  const sql = `
    SELECT t.*, COALESCE(cc.category,'unknown') AS category, p.name AS project_name
    FROM threads t
    LEFT JOIN company_categories cc ON cc.domain=t.company_domain
    LEFT JOIN projects p ON p.id = t.project_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.last_msg_date DESC
    LIMIT @limit OFFSET @offset
  `
  return db.prepare(sql).all(params) as Thread[]
}

export function getThread(id: string): ThreadDetail | null {
  const db = getReadDb()
  const thread = db.prepare(
    `SELECT t.*, p.name AS project_name FROM threads t
     LEFT JOIN projects p ON p.id = t.project_id WHERE t.id=?`,
  ).get(id) as Thread | undefined
  if (!thread) return null
  const mails = db.prepare('SELECT * FROM mails WHERE thread_id=? ORDER BY date DESC').all(id) as Mail[]
  const todos = db.prepare(
    `SELECT tt.*, m.date as mail_date, m.subject as mail_subject,
            COALESCE(cc.category,'unknown') as category
     FROM todos tt JOIN mails m ON m.uid=tt.mail_uid
     LEFT JOIN company_categories cc ON cc.domain=tt.client_domain
     WHERE m.thread_id=? ORDER BY tt.done, m.date DESC`,
  ).all(id) as Todo[]
  const attachments = db.prepare(
    `SELECT a.*, m.subject as mail_subject, m.date as mail_date, m.from_email
     FROM attachments a JOIN mails m ON m.uid=a.mail_uid
     WHERE m.thread_id=? ORDER BY m.date DESC`,
  ).all(id) as Attachment[]
  const links = db.prepare(
    `SELECT l.*, m.subject as mail_subject, m.date as mail_date
     FROM links l JOIN mails m ON m.uid=l.mail_uid
     WHERE m.thread_id=? ORDER BY m.date DESC`,
  ).all(id) as Link[]

  let client: ClientSummary | null = null
  let project: Project | null = null
  if (thread.company_domain) {
    client = db.prepare(
      `SELECT c.domain, c.name, COALESCE(cc.category,'unknown') AS category,
              c.email_count, c.last_seen, 0 AS thread_count, 0 AS open_threads
       FROM companies c LEFT JOIN company_categories cc ON cc.domain=c.domain
       WHERE c.domain=?`,
    ).get(thread.company_domain) as ClientSummary | null
  }
  if (thread.project_id) {
    project = db.prepare('SELECT * FROM projects WHERE id=?').get(thread.project_id) as Project | null
  }
  return { thread, mails, todos, attachments, links, client, project }
}

// TODOS
export function listTodos(opts: {
  openOnly?: boolean; owner?: string; category?: string;
  dueSoon?: boolean; recentOnly?: boolean; limit?: number;
  projectId?: number;
} = {}): Todo[] {
  const db = getReadDb()
  const where: string[] = []
  const params: Record<string, any> = {}
  if (opts.openOnly !== false) where.push('tt.done = 0')
  if (opts.owner) { where.push('tt.owner = @owner'); params.owner = opts.owner }
  if (opts.dueSoon) where.push(`(tt.deadline IS NOT NULL AND tt.deadline <= date('now', '+7 days'))`)
  if (opts.recentOnly !== false) where.push(`m.date >= ${DAYS_14}`)
  if (opts.projectId != null) { where.push('t.project_id = @pid'); params.pid = opts.projectId }
  if (opts.category && opts.category !== 'all') {
    if (opts.category === 'client-only') where.push("cc.category = 'client'")
    else { where.push("COALESCE(cc.category,'unknown') = @category"); params.category = opts.category }
  } else {
    where.push("cc.category = 'client'")
  }
  params.limit = opts.limit ?? 500
  const sql = `
    SELECT tt.*, m.date as mail_date, m.subject as mail_subject,
           COALESCE(cc.category,'unknown') as category,
           t.project_id, p.name as project_name
    FROM todos tt
    JOIN mails m ON m.uid=tt.mail_uid
    LEFT JOIN threads t ON t.id = m.thread_id
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN company_categories cc ON cc.domain=tt.client_domain
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      CASE WHEN tt.deadline IS NOT NULL AND tt.deadline <= date('now','+7 days') THEN 0 ELSE 1 END,
      m.date DESC
    LIMIT @limit
  `
  return db.prepare(sql).all(params) as Todo[]
}

// ATTACHMENTS
export function listAttachments(opts: { mime?: string; clientDomain?: string; limit?: number } = {}): Attachment[] {
  const db = getReadDb()
  const where: string[] = []
  const params: Record<string, any> = {}
  if (opts.mime) { where.push('a.mime LIKE @mime'); params.mime = `${opts.mime}%` }
  if (opts.clientDomain) { where.push('t.company_domain = @domain'); params.domain = opts.clientDomain }
  params.limit = opts.limit ?? 500
  const sql = `
    SELECT a.*, m.subject as mail_subject, m.date as mail_date, m.from_email,
           t.company_domain as client_domain, t.id as thread_id, t.project_id,
           COALESCE(cc.category,'unknown') as category
    FROM attachments a JOIN mails m ON m.uid=a.mail_uid
    LEFT JOIN threads t ON t.id=m.thread_id
    LEFT JOIN company_categories cc ON cc.domain=t.company_domain
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.date DESC LIMIT @limit
  `
  return db.prepare(sql).all(params) as Attachment[]
}

export function attachmentsByThread(opts: { mime?: string; clientDomain?: string } = {}): AttachmentsByThread[] {
  const atts = listAttachments({ ...opts, limit: 1000 })
  const groups = new Map<string, AttachmentsByThread>()
  const db = getReadDb()
  for (const a of atts) {
    const tid = a.thread_id ?? 'no-thread'
    let g = groups.get(tid)
    if (!g) {
      const threadRow = (tid !== 'no-thread' ? db.prepare(
        `SELECT t.*, p.name AS project_name FROM threads t
         LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?`,
      ).get(tid) : null) as any
      g = {
        thread_id: tid,
        subject_root: threadRow?.subject_root ?? 'Senza thread',
        company_domain: threadRow?.company_domain ?? a.client_domain ?? null,
        category: (a.category as Category) ?? 'unknown',
        project_id: threadRow?.project_id ?? null,
        project_name: threadRow?.project_name ?? null,
        last_msg_date: threadRow?.last_msg_date ?? a.mail_date ?? null,
        attachments: [],
      }
      groups.set(tid, g)
    }
    g.attachments.push(a)
  }
  return Array.from(groups.values()).sort((x, y) => {
    return (y.last_msg_date ?? '').localeCompare(x.last_msg_date ?? '')
  })
}

export function getAttachment(id: number): Attachment | null {
  const db = getReadDb()
  return db.prepare(
    `SELECT a.*, m.subject as mail_subject, m.date as mail_date, m.from_email,
            t.company_domain as client_domain, t.id as thread_id, t.project_id
     FROM attachments a JOIN mails m ON m.uid=a.mail_uid
     LEFT JOIN threads t ON t.id=m.thread_id
     WHERE a.id=?`,
  ).get(id) as Attachment | null
}

// LINKS
export function listLinks(opts: { domain?: string; search?: string; limit?: number } = {}): Link[] {
  const db = getReadDb()
  const where: string[] = []
  const params: Record<string, any> = {}
  if (opts.domain) { where.push("l.url LIKE '%'||@domain||'%'"); params.domain = opts.domain }
  if (opts.search) {
    where.push("(l.url LIKE @q OR COALESCE(l.context,'') LIKE @q OR COALESCE(m.subject,'') LIKE @q)")
    params.q = `%${opts.search}%`
  }
  params.limit = opts.limit ?? 200
  const sql = `
    SELECT l.*, m.subject as mail_subject, m.date as mail_date,
           t.company_domain as client_domain,
           COALESCE(cc.category,'unknown') as category
    FROM links l JOIN mails m ON m.uid=l.mail_uid
    LEFT JOIN threads t ON t.id=m.thread_id
    LEFT JOIN company_categories cc ON cc.domain=t.company_domain
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.date DESC LIMIT @limit
  `
  return db.prepare(sql).all(params) as Link[]
}

export function topLinkDomains(limit = 10): TopDomain[] {
  return getReadDb().prepare(
    `SELECT substr(url, instr(url,'//')+2,
      CASE WHEN instr(substr(url, instr(url,'//')+2),'/') > 0
           THEN instr(substr(url, instr(url,'//')+2),'/') - 1
           ELSE length(url) END
    ) AS domain, COUNT(*) AS count
    FROM links WHERE url LIKE 'http%' GROUP BY domain ORDER BY count DESC LIMIT ?`,
  ).all(limit) as TopDomain[]
}

export function listRuns(limit = 20): Run[] {
  return getReadDb().prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit) as Run[]
}

export function schedulerStatus(): SchedulerStatus {
  const db = getReadDb()
  const last = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').get() as Run | undefined
  let running = false
  if (last?.ran_at) {
    const ranAt = new Date(last.ran_at.replace(' ', 'T') + 'Z')
    running = Date.now() - ranAt.getTime() < 10 * 60 * 1000
  }
  return { running, pid: null, last_run: last ?? null }
}

// CHAT
export function getChat(entity_type: EntityType, entity_id: string): ChatThread | null {
  const db = getReadDb()
  const t = db.prepare(
    'SELECT * FROM chat_threads WHERE entity_type=? AND entity_id=?',
  ).get(entity_type, entity_id) as ChatThread | undefined
  if (!t) return null
  const messages = db.prepare(
    'SELECT * FROM chat_messages WHERE chat_thread_id=? ORDER BY id ASC',
  ).all(t.id) as ChatMessage[]
  return { ...t, messages }
}
