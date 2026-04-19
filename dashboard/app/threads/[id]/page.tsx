import { notFound } from 'next/navigation'
import Link from 'next/link'
import { User, Clock, Paperclip, ListTodo, Link2, FolderKanban, Users, MessagesSquare } from 'lucide-react'
import { getThread } from '@/lib/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CategoryBadge } from '@/components/category-badge'
import { ChatSheet } from '@/components/chat-sheet'
import { AttachmentPreview } from '@/components/attachment-preview'
import { MailBody } from '@/components/mail-body'
import { ReplyComposer } from '@/components/reply-composer'
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
  const palette = ['bg-emerald-900/40 text-emerald-300', 'bg-sky-900/40 text-sky-300',
    'bg-amber-900/40 text-amber-300', 'bg-violet-900/40 text-violet-300',
    'bg-rose-900/40 text-rose-300', 'bg-teal-900/40 text-teal-300']
  return palette[Math.abs(hash) % palette.length]
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tid = decodeURIComponent(id)
  const d = getThread(tid)
  if (!d) notFound()

  const realAttachments = d.attachments.filter((a) => (a as any).is_inline !== 1)
  const sigCount = d.attachments.length - realAttachments.length

  // Sort mails chronologically (oldest first → newest at bottom)
  const mailsChrono = [...d.mails].sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const openTodos = d.todos.filter((t) => !t.done)
  const doneTodos = d.todos.filter((t) => t.done)
  const lastMail = mailsChrono[mailsChrono.length - 1]

  // Build a condensed context for Napoleon chat (subjects + dates + from + first body lines)
  const chatContext = [
    `Thread: ${d.thread.subject_root}`,
    `Cliente: ${d.thread.company_domain ?? '—'} (${d.client?.category ?? 'unknown'})`,
    d.project ? `Progetto: ${d.project.name}` : '',
    `Messaggi: ${d.mails.length}`,
    `Ultima attività: ${d.thread.last_msg_date}`,
    '',
    '--- Cronologia messaggi ---',
    ...mailsChrono.slice(-6).map((m) => {
      const body = (m as any).body_text ? String((m as any).body_text).slice(0, 600) : '(contenuto non caricato)'
      return `[${shortDate(m.date)}] ${m.from_email}: ${m.subject}\n${body}\n`
    }),
    '',
    openTodos.length ? '--- Task aperti ---\n' + openTodos.map((t) => `- ${t.text}`).join('\n') : '',
    realAttachments.length ? '--- Allegati ---\n' + realAttachments.map((a) => `- ${a.filename} (${a.mime})`).join('\n') : '',
  ].filter(Boolean).join('\n')

  return (
    <div className="space-y-6">
      <Link href="/threads" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        ← Tutte le conversazioni
      </Link>

      {/* Conversation header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              {d.thread.subject_root}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {d.thread.company_domain ? (
                <Link href={`/clients/${encodeURIComponent(d.thread.company_domain)}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Users className="h-3 w-3" />
                  {d.thread.company_domain}
                </Link>
              ) : null}
              {d.client?.category ? <CategoryBadge category={d.client.category} /> : null}
              {d.project ? (
                <Link href={`/projects/${d.project.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <FolderKanban className="h-3 w-3" />
                  {d.project.name}
                </Link>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <MessagesSquare className="h-3 w-3" /> {d.mails.length} messaggi
              </span>
              {realAttachments.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> {realAttachments.length} allegati
                </span>
              )}
              {openTodos.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ListTodo className="h-3 w-3" /> {openTodos.length} task aperti
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {lastMail && (
              <ReplyComposer
                mailUid={lastMail.uid}
                originalSubject={d.thread.subject_root}
                originalFrom={lastMail.from_email}
                threadId={d.thread.id}
                clientDomain={d.thread.company_domain}
              />
            )}
            <ChatSheet
              entityType="thread"
              entityId={d.thread.id}
              label={d.thread.subject_root}
              clientDomain={d.thread.company_domain}
              projectName={d.project?.name ?? null}
              contextData={chatContext}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Conversation body */}
        <section className="space-y-0">
          {mailsChrono.map((m, idx) => {
            const color = colorForEmail(m.from_email)
            return (
              <article key={m.uid} className={idx === 0 ? 'pt-0' : 'pt-6'}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium ${color}`}>
                    {initialsOf(m.from_name, m.from_email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{m.from_name ?? m.from_email.split('@')[0]}</span>
                          <span className="text-xs text-muted-foreground truncate">&lt;{m.from_email}&gt;</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shortDate(m.date)} · {relativeItalian(m.date)}
                          <span className="mx-1">·</span>
                          <code className="text-[10px]">UID {m.uid}</code>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <ReplyComposer
                          mailUid={m.uid}
                          originalSubject={m.subject}
                          originalFrom={m.from_email}
                          threadId={d.thread.id}
                          clientDomain={d.thread.company_domain}
                        />
                        <ChatSheet
                          entityType="mail"
                          entityId={String(m.uid)}
                          label={m.subject}
                          clientDomain={d.thread.company_domain}
                          projectName={d.project?.name ?? null}
                          triggerVariant="ghost"
                          iconOnly
                          contextData={`Mail UID ${m.uid} — ${m.subject}\nDa: ${m.from_email} · ${shortDate(m.date)}\nThread: ${d.thread.subject_root}`}
                        />
                      </div>
                    </div>
                    {m.subject !== d.thread.subject_root && (
                      <div className="text-sm text-muted-foreground mt-1">{m.subject}</div>
                    )}
                    <div className="mt-3 rounded-lg border border-border/40 bg-card/30">
                      <MailBody uid={m.uid} subject={m.subject} autoLoad />
                    </div>
                  </div>
                </div>
                {idx < mailsChrono.length - 1 && <Separator className="my-6" />}
              </article>
            )
          })}
        </section>

        {/* Sidebar metadata */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          {realAttachments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm inline-flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Allegati ({realAttachments.length})
                  {sigCount > 0 && <span className="text-xs text-muted-foreground font-normal">+{sigCount} firme nascoste</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {realAttachments.map((a) => (
                  <AttachmentPreview key={a.id} att={a} />
                ))}
              </CardContent>
            </Card>
          )}

          {d.todos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm inline-flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Task ({openTodos.length} aperti)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {openTodos.map((t) => (
                  <div key={t.id} className="text-sm">
                    <div className="text-foreground">{t.text}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t.owner}
                      {t.deadline ? <Badge variant="amber" className="ml-1">{t.deadline}</Badge> : null}
                    </div>
                  </div>
                ))}
                {doneTodos.length > 0 && (
                  <details>
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground mt-2">{doneTodos.length} completati</summary>
                    <div className="mt-2 space-y-1">
                      {doneTodos.map((t) => (
                        <div key={t.id} className="text-xs text-muted-foreground line-through">{t.text}</div>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          {d.links.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm inline-flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Link ({d.links.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.links.slice(0, 20).map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener" className="block text-xs text-sky-300 hover:underline truncate">
                    {l.url}
                  </a>
                ))}
                {d.links.length > 20 && (
                  <div className="text-xs text-muted-foreground">+{d.links.length - 20} altri</div>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
