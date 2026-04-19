import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock, Paperclip, ListTodo, Link2, FolderKanban, Users, MessagesSquare } from 'lucide-react'
import { getThread } from '@/lib/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { ChatSheet } from '@/components/chat-sheet'
import { AttachmentPreview } from '@/components/attachment-preview'
import { MailBody } from '@/components/mail-body'
import { ReplyComposer } from '@/components/reply-composer'
import { GenerateTodosButton } from '@/components/generate-todos-button'
import { relativeItalian, shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function initialsOf(name: string | null | undefined, email: string): string {
  const src = (name || email || '').trim()
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts[1]?.[0] ?? (src[1] ?? '')
  return (a + b).toUpperCase().slice(0, 2)
}

function colorForEmail(email: string): string {
  let hash = 0
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) | 0
  const palette = [
    'bg-emerald-900/40 text-emerald-300',
    'bg-sky-900/40 text-sky-300',
    'bg-amber-900/40 text-amber-300',
    'bg-violet-900/40 text-violet-300',
    'bg-rose-900/40 text-rose-300',
    'bg-teal-900/40 text-teal-300',
  ]
  return palette[Math.abs(hash) % palette.length]
}

const ME_DOMAINS = ['verganiegasco.it', 'verganiegasco.com', 'gasco.pro']

function isMine(email: string): boolean {
  const e = email.toLowerCase()
  return ME_DOMAINS.some((d) => e.endsWith('@' + d))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tid = decodeURIComponent(id)
  const d = getThread(tid)
  if (!d) notFound()

  const realAttachments = d.attachments.filter((a: any) => a.is_inline !== 1)
  const sigCount = d.attachments.length - realAttachments.length
  const mailsChrono = [...d.mails].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const lastMail = mailsChrono[mailsChrono.length - 1]
  const openTodos = d.todos.filter((t) => !t.done)

  const chatContext = [
    `Thread: ${d.thread.subject_root}`,
    `Cliente: ${d.thread.company_domain ?? '—'} (${d.client?.category ?? 'unknown'})`,
    d.project ? `Progetto: ${d.project.name}` : '',
    `Messaggi: ${d.mails.length}`,
    '',
    '--- Cronologia ---',
    ...mailsChrono.slice(-8).map((m) => {
      const body = (m as any).body_text ? String((m as any).body_text).slice(0, 500) : '(body non caricato)'
      return `[${shortDate(m.date)}] ${m.from_email}: ${m.subject}\n${body}\n`
    }),
    openTodos.length ? '--- Task aperti ---\n' + openTodos.map((t) => `- ${t.text}`).join('\n') : '',
  ].filter(Boolean).join('\n')

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <Link href="/threads" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        ← Conversazioni
      </Link>

      {/* Compact header */}
      <header className="space-y-2">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight">{d.thread.subject_root}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {d.thread.company_domain ? (
            <Link href={`/clients/${encodeURIComponent(d.thread.company_domain)}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Users className="h-3 w-3" /> {d.thread.company_domain}
            </Link>
          ) : null}
          {d.client?.category ? <CategoryBadge category={d.client.category} /> : null}
          {d.project ? (
            <Link href={`/projects/${d.project.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <FolderKanban className="h-3 w-3" /> {d.project.name}
            </Link>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <MessagesSquare className="h-3 w-3" /> {d.mails.length}
          </span>
          {realAttachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {realAttachments.length}
            </span>
          )}
          {openTodos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListTodo className="h-3 w-3" /> {openTodos.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastMail && (
            <ReplyComposer
              mailUid={lastMail.uid}
              originalSubject={d.thread.subject_root}
              originalFrom={lastMail.from_email}
              threadId={d.thread.id}
              clientDomain={d.thread.company_domain}
            />
          )}
          <GenerateTodosButton threadId={d.thread.id} projectName={d.project?.name ?? d.thread.subject_root} />
          <ChatSheet
            entityType="thread"
            entityId={d.thread.id}
            label={d.thread.subject_root}
            clientDomain={d.thread.company_domain}
            projectName={d.project?.name ?? null}
            contextData={chatContext}
          />
        </div>
      </header>

      {/* Chat-like conversation */}
      <section className="space-y-4">
        {mailsChrono.map((m) => {
          const mine = isMine(m.from_email)
          const color = colorForEmail(m.from_email)
          return (
            <div key={m.uid} className={`flex items-start gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium ${mine ? 'bg-primary/80 text-primary-foreground' : color}`}>
                {initialsOf(m.from_name, m.from_email)}
              </div>
              <div className={`flex-1 min-w-0 max-w-[85%] ${mine ? 'text-right' : ''}`}>
                <div className={`inline-flex items-center gap-2 text-xs text-muted-foreground mb-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span className="font-medium text-foreground/90">{mine ? 'Tu' : (m.from_name ?? m.from_email.split('@')[0])}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />{shortDate(m.date)}
                  </span>
                </div>
                <div className={`rounded-2xl border border-border/40 ${mine ? 'bg-primary/5 rounded-tr-sm' : 'bg-card/50 rounded-tl-sm'} overflow-hidden`}>
                  <MailBody uid={m.uid} subject={m.subject} autoLoad />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* Compact metadata strip */}
      {(realAttachments.length > 0 || openTodos.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {realAttachments.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2 inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Allegati ({realAttachments.length})
                  {sigCount > 0 && <span className="text-xs opacity-70 ml-2">+{sigCount} firme nascoste</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {realAttachments.map((a) => <AttachmentPreview key={a.id} att={a} />)}
                </div>
              </div>
            )}
            {openTodos.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2 inline-flex items-center gap-1">
                  <ListTodo className="h-3 w-3" /> Task aperti ({openTodos.length})
                </div>
                <div className="space-y-1 text-sm">
                  {openTodos.map((t) => (
                    <div key={t.id}>
                      <span>{t.text}</span>
                      <span className="text-xs text-muted-foreground ml-2">· {t.owner}</span>
                      {t.deadline && <Badge variant="amber" className="ml-2">{t.deadline}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
