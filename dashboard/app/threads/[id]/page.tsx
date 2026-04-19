import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getThread } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { ChatSheet } from '@/components/chat-sheet'
import { AttachmentPreview } from '@/components/attachment-preview'
import { MailBody } from '@/components/mail-body'
import { relativeItalian, shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tid = decodeURIComponent(id)
  const d = getThread(tid)
  if (!d) notFound()

  const realAttachments = d.attachments.filter((a) => (a as any).is_inline !== 1)
  const sigCount = d.attachments.length - realAttachments.length

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/threads" className="text-xs text-muted-foreground hover:text-foreground">← Conversazioni</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{d.thread.subject_root}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              <code>#{d.thread.id.slice(0, 64)}</code>
              {d.thread.company_domain ? (
                <Link href={`/clients/${encodeURIComponent(d.thread.company_domain)}`} className="hover:underline">
                  {d.thread.company_domain}
                </Link>
              ) : null}
              {d.client?.category ? <CategoryBadge category={d.client.category} /> : null}
              {d.project ? (
                <Link href={`/projects/${d.project.id}`} className="hover:underline">
                  Progetto: {d.project.name}
                </Link>
              ) : null}
              <Badge variant="slate">{d.thread.status}</Badge>
              <span>{d.thread.message_count} messaggi</span>
            </div>
          </div>
          <ChatSheet
            entityType="thread"
            entityId={d.thread.id}
            label={d.thread.subject_root}
            clientDomain={d.thread.company_domain}
            projectName={d.project?.name ?? null}
          />
        </div>
      </header>

      <Tabs defaultValue="mails" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mails">Messaggi ({d.mails.length})</TabsTrigger>
          <TabsTrigger value="tasks">Task ({d.todos.length})</TabsTrigger>
          <TabsTrigger value="attachments">Allegati ({realAttachments.length}{sigCount ? ` +${sigCount} firme` : ''})</TabsTrigger>
          <TabsTrigger value="links">Link ({d.links.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mails" className="space-y-3">
          {d.mails.map((m) => (
            <Card key={m.uid}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code>UID #{m.uid}</code>
                      <span>·</span>
                      <span>{shortDate(m.date)} ({relativeItalian(m.date)})</span>
                    </div>
                    <CardTitle className="text-base mt-1">{m.subject}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {m.from_name ? `${m.from_name} · ` : ''}{m.from_email}
                    </CardDescription>
                  </div>
                  <ChatSheet
                    entityType="mail"
                    entityId={String(m.uid)}
                    label={m.subject}
                    clientDomain={d.thread.company_domain}
                    projectName={d.project?.name ?? null}
                    triggerVariant="ghost"
                    iconOnly
                  />
                </div>
              </CardHeader>
              <CardContent>
                <MailBody uid={m.uid} subject={m.subject} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Messaggio</TableHead>
                    <TableHead>Responsabile</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.todos.map((t) => (
                    <TableRow key={t.id} className={t.done ? 'opacity-60' : ''}>
                      <TableCell className="text-xs text-muted-foreground">#{t.id}</TableCell>
                      <TableCell className="max-w-[460px]">{t.text}</TableCell>
                      <TableCell><Badge variant="slate">{t.owner}</Badge></TableCell>
                      <TableCell>{t.done ? <Badge variant="emerald">Fatto</Badge> : <Badge variant="amber">Aperto</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{relativeItalian(t.mail_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <div className="text-xs text-muted-foreground mb-3">
            Mostrati solo allegati reali (firme e immagini inline esclusi).
          </div>
          {realAttachments.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nessun allegato.</CardContent></Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {realAttachments.map((a) => (
                <AttachmentPreview key={a.id} att={a} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.links.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">#{l.id}</TableCell>
                      <TableCell><a href={l.url} target="_blank" rel="noopener" className="hover:underline text-sky-300 truncate block max-w-[420px]">{l.url}</a></TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]">{l.mail_subject}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{shortDate(l.mail_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
