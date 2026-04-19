import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClient } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CategoryBadge } from '@/components/category-badge'
import { ClientCategorySelect } from '@/components/client-category-select'
import { AttachmentPreview } from '@/components/attachment-preview'
import { ChatSheet } from '@/components/chat-sheet'
import { relativeItalian, shortDate } from '@/lib/utils'
import type { Thread, Todo, Attachment, Link as LinkT } from '@/lib/types'

export const dynamic = 'force-dynamic'

type ThreadGroup<T> = { thread: Thread; items: T[] }

function groupByThread<T extends { mail_uid: number }>(items: T[], threads: Thread[]): ThreadGroup<T>[] {
  // We can't directly group attachments/todos by thread_id from our type — but `server.ts` includes thread_id for attachments.
  // For todos: they only have mail_uid; we rely on that being present in thread.mails.
  // Build a map uid→thread
  // Since we don't have mails list here, group by 'thread_id' field if present, else fallback by iterating threads.
  const map = new Map<string, ThreadGroup<T>>()
  for (const t of threads) map.set(t.id, { thread: t, items: [] })

  const result: ThreadGroup<T>[] = []
  for (const it of items) {
    const tid = (it as any).thread_id as string | undefined
    if (tid && map.has(tid)) {
      map.get(tid)!.items.push(it)
    }
  }
  for (const g of map.values()) if (g.items.length) result.push(g)
  return result.sort(
    (a, b) => (b.thread.last_msg_date || '').localeCompare(a.thread.last_msg_date || ''),
  )
}

function sortByDate<T extends { mail_date?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (b.mail_date || '').localeCompare(a.mail_date || ''))
}

export default async function Page({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const c = getClient(decodeURIComponent(domain))
  if (!c) notFound()

  const todoGroups = groupByThread(
    sortByDate(c.todos) as any,
    c.threads,
  ) as ThreadGroup<Todo>[]
  const attachmentGroups = groupByThread(
    sortByDate(c.attachments.filter((a: any) => a.is_inline !== 1)) as any,
    c.threads,
  ) as ThreadGroup<Attachment>[]
  const linkGroups = groupByThread(sortByDate(c.links) as any, c.threads) as ThreadGroup<LinkT>[]

  return (
    <div className="space-y-6">
      <Link href="/clients" className="text-xs text-muted-foreground hover:text-foreground">← Clienti</Link>
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{c.name ?? c.domain}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <code className="text-xs text-muted-foreground">{c.domain}</code>
              <CategoryBadge category={c.category} />
              <ClientCategorySelect domain={c.domain} value={c.category} />
            </div>
          </div>
          <ChatSheet
            entityType="client"
            entityId={c.domain}
            label={c.name ?? c.domain}
            clientDomain={c.domain}
          />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Mail</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.email_count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Thread aperti</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.open_threads}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Progetti</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.projects?.length ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Task aperti</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.todos.filter((t: any) => !t.done).length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Allegati</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.attachments.filter((a: any) => a.is_inline !== 1).length}</CardContent></Card>
      </section>

      <Tabs defaultValue="threads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threads">Conversazioni ({c.threads.length})</TabsTrigger>
          <TabsTrigger value="projects">Progetti ({c.projects?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tasks">Task</TabsTrigger>
          <TabsTrigger value="attachments">Allegati</TabsTrigger>
          <TabsTrigger value="links">Link</TabsTrigger>
        </TabsList>

        <TabsContent value="threads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Progetto</TableHead>
                    <TableHead>Messaggi</TableHead>
                    <TableHead>Ultima attività</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.threads.map((t: Thread) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/threads/${encodeURIComponent(t.id)}`} className="hover:underline font-medium">{t.subject_root}</Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{(t as any).project_name ?? '—'}</TableCell>
                      <TableCell>{t.message_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{relativeItalian(t.last_msg_date)}</TableCell>
                      <TableCell><Badge variant="slate">{t.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Thread</TableHead>
                    <TableHead>Ultima attività</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(c.projects ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">#{p.id}</TableCell>
                      <TableCell><Link href={`/projects/${p.id}`} className="hover:underline font-medium">{p.name}</Link></TableCell>
                      <TableCell><Badge variant={p.status === 'active' ? 'emerald' : 'slate'}>{p.status}</Badge></TableCell>
                      <TableCell>{p.thread_count ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{relativeItalian(p.last_activity ?? null)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          {todoGroups.length === 0 ? (
            <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">Nessun task associato a thread.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {todoGroups.map((g) => (
                <Card key={g.thread.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <Link href={`/threads/${encodeURIComponent(g.thread.id)}`} className="hover:underline">
                        {g.thread.subject_root}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {shortDate(g.thread.last_msg_date)} · {g.items.length} task
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {g.items.map((t) => (
                      <div key={t.id} className={`text-sm ${t.done ? 'line-through opacity-60' : ''}`}>
                        <div>{t.text}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.owner} · {shortDate(t.mail_date)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attachments">
          {attachmentGroups.length === 0 ? (
            <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">Nessun allegato (firme inline escluse).</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {attachmentGroups.map((g) => (
                <Card key={g.thread.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <Link href={`/threads/${encodeURIComponent(g.thread.id)}`} className="hover:underline">
                        {g.thread.subject_root}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {shortDate(g.thread.last_msg_date)} · {g.items.length} file
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((a) => (
                        <AttachmentPreview key={a.id} att={a} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="links">
          {linkGroups.length === 0 ? (
            <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">Nessun link.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {linkGroups.map((g) => (
                <Card key={g.thread.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <Link href={`/threads/${encodeURIComponent(g.thread.id)}`} className="hover:underline">
                        {g.thread.subject_root}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {shortDate(g.thread.last_msg_date)} · {g.items.length} link
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {g.items.map((l) => (
                      <a key={l.id} href={l.url} target="_blank" rel="noopener" className="block text-xs text-sky-300 hover:underline truncate">
                        {l.url}
                      </a>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
