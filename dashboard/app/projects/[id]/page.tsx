import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProject } from '@/lib/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { ChatSheet } from '@/components/chat-sheet'
import { AttachmentPreview } from '@/components/attachment-preview'
import { relativeItalian, shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = getProject(Number(id))
  if (!p) notFound()

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">← Progetti</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>Progetto #{p.id}</span>
              <span>·</span>
              <Badge variant={p.status === 'active' ? 'emerald' : 'slate'}>
                {p.status === 'active' ? 'Attivo' : p.status === 'paused' ? 'Pausa' : p.status === 'done' ? 'Completato' : 'Archiviato'}
              </Badge>
              {p.client ? (
                <>
                  <span>·</span>
                  <Link href={`/clients/${encodeURIComponent(p.client_domain)}`} className="hover:underline">
                    {p.client.name ?? p.client.domain}
                  </Link>
                  <CategoryBadge category={p.client.category} />
                </>
              ) : null}
            </div>
            {p.notes ? <p className="text-sm mt-2">{p.notes}</p> : null}
          </div>
          <ChatSheet
            entityType="project"
            entityId={String(p.id)}
            label={p.name}
            clientDomain={p.client_domain}
            projectName={p.name}
          />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Thread</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{p.threads.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Task aperti</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{p.todos.filter((t) => !t.done).length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Allegati</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{p.attachments.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Link</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{p.links.length}</CardContent></Card>
      </section>

      <Tabs defaultValue="threads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threads">Conversazioni ({p.threads.length})</TabsTrigger>
          <TabsTrigger value="tasks">Task ({p.todos.length})</TabsTrigger>
          <TabsTrigger value="attachments">Allegati ({p.attachments.length})</TabsTrigger>
          <TabsTrigger value="links">Link ({p.links.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="threads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Messaggi</TableHead>
                    <TableHead>Ultima attività</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.threads.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{t.id}</TableCell>
                      <TableCell><Link href={`/threads/${encodeURIComponent(t.id)}`} className="hover:underline font-medium">{t.subject_root}</Link></TableCell>
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
                  {p.todos.map((t) => (
                    <TableRow key={t.id} className={t.done ? 'opacity-60' : ''}>
                      <TableCell className="text-xs text-muted-foreground">#{t.id}</TableCell>
                      <TableCell className="max-w-[360px]">{t.text}</TableCell>
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
          <div className="grid gap-2 sm:grid-cols-2">
            {p.attachments.map((a) => (
              <AttachmentPreview key={a.id} att={a} />
            ))}
          </div>
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
                  {p.links.map((l) => (
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
