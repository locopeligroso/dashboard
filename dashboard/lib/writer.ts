import 'server-only'
import { getWriteDb } from './db'
import type { Category, ChatMessage, ChatThread, EntityType, Project } from './types'

const CATEGORIES = new Set<Category>(['client', 'vendor', 'award', 'newsletter', 'internal', 'unknown'])
const OWNERS = new Set(['giuseppe', 'team', 'cliente', 'shared'])
const PROJECT_STATUSES = new Set(['active', 'paused', 'done', 'archived'])

export function toggleTodoDone(id: number): { done: number } {
  const db = getWriteDb()
  const cur = db.prepare('SELECT done FROM todos WHERE id=?').get(id) as { done: number } | undefined
  if (!cur) throw new Error('todo not found')
  const next = cur.done ? 0 : 1
  db.prepare('UPDATE todos SET done=? WHERE id=?').run(next, id)
  return { done: next }
}

export function setTodoOwner(id: number, owner: string): void {
  if (!OWNERS.has(owner)) throw new Error(`invalid owner: ${owner}`)
  getWriteDb().prepare('UPDATE todos SET owner=? WHERE id=?').run(owner, id)
}

export function setCompanyCategory(domain: string, category: string, notes?: string | null): void {
  if (!CATEGORIES.has(category as Category)) throw new Error(`invalid category: ${category}`)
  getWriteDb().prepare(
    `INSERT INTO company_categories(domain, category, notes, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(domain) DO UPDATE SET
       category=excluded.category,
       notes=COALESCE(excluded.notes, company_categories.notes),
       updated_at=CURRENT_TIMESTAMP`,
  ).run(domain, category, notes ?? null)
}

export function createProject(client_domain: string, name: string, notes?: string): Project {
  const db = getWriteDb()
  const cur = db.prepare(
    "INSERT INTO projects(client_domain, name, notes, status) VALUES (?, ?, ?, 'active')",
  ).run(client_domain, name, notes ?? null)
  return db.prepare('SELECT * FROM projects WHERE id=?').get(cur.lastInsertRowid) as Project
}

export function updateProject(id: number, patch: { name?: string; status?: string; notes?: string | null }): void {
  const db = getWriteDb()
  const sets: string[] = []
  const params: any[] = []
  if (patch.name !== undefined) { sets.push('name=?'); params.push(patch.name) }
  if (patch.status !== undefined) {
    if (!PROJECT_STATUSES.has(patch.status)) throw new Error('invalid status')
    sets.push('status=?'); params.push(patch.status)
  }
  if (patch.notes !== undefined) { sets.push('notes=?'); params.push(patch.notes) }
  if (!sets.length) return
  sets.push('updated_at=CURRENT_TIMESTAMP')
  params.push(id)
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id=?`).run(...params)
}

export function setThreadProject(threadId: string, projectId: number | null): void {
  getWriteDb().prepare('UPDATE threads SET project_id=? WHERE id=?').run(projectId, threadId)
}

export function ensureChatThread(entity_type: EntityType, entity_id: string, title?: string | null): ChatThread {
  const db = getWriteDb()
  const existing = db.prepare(
    'SELECT * FROM chat_threads WHERE entity_type=? AND entity_id=?',
  ).get(entity_type, entity_id) as ChatThread | undefined
  if (existing) return existing
  const cur = db.prepare(
    'INSERT INTO chat_threads(entity_type, entity_id, title) VALUES (?, ?, ?)',
  ).run(entity_type, entity_id, title ?? null)
  return db.prepare('SELECT * FROM chat_threads WHERE id=?').get(cur.lastInsertRowid) as ChatThread
}

export function appendMessage(
  chat_thread_id: number,
  role: 'user' | 'napoleon' | 'system',
  content: string,
  status: 'ok' | 'pending' | 'error' = 'ok',
  error?: string | null,
): ChatMessage {
  const db = getWriteDb()
  const cur = db.prepare(
    'INSERT INTO chat_messages(chat_thread_id, role, content, status, error) VALUES (?, ?, ?, ?, ?)',
  ).run(chat_thread_id, role, content, status, error ?? null)
  db.prepare('UPDATE chat_threads SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(chat_thread_id)
  return db.prepare('SELECT * FROM chat_messages WHERE id=?').get(cur.lastInsertRowid) as ChatMessage
}

export function updateMessage(id: number, patch: { content?: string; status?: string; error?: string | null }): void {
  const db = getWriteDb()
  const sets: string[] = []
  const params: any[] = []
  if (patch.content !== undefined) { sets.push('content=?'); params.push(patch.content) }
  if (patch.status !== undefined) { sets.push('status=?'); params.push(patch.status) }
  if (patch.error !== undefined) { sets.push('error=?'); params.push(patch.error) }
  if (!sets.length) return
  params.push(id)
  db.prepare(`UPDATE chat_messages SET ${sets.join(', ')} WHERE id=?`).run(...params)
}
