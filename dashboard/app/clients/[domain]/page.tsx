import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClient } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ClientCategorySelect } from '@/components/client-category-select'
import { CategoryBadge } from '@/components/category-badge'
import { formatBytes, relativeItalian, shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ domain: string }> }) {
  const p = await params

  const domain = decodeURIComponent(p.domain)
  const c = getClient(domain)
  if (!c) notFound()

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/clients" className="text-xs text-muted-foreground hover:text-foreground">← Clienti</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{c.name ?? c.domain}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <code className="text-xs text-muted-foreground">{c.domain}</code>
          <CategoryBadge category={c.category} />
          <ClientCategorySelect domain={c.domain} value={c.category} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Mail</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.email_count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Conversazioni aperte</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.open_threads}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Task aperti</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.todos.filter((t) => !t.done).length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Allegati</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{c.attachments.length}</CardContent></Card>
      </section>

      <Tabs defaultValue="threads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threads">Conversazioni ({c.threads.length})</TabsTrigger>
          <TabsTrigger value="tasks">Task ({c.todos.length})</TabsTrigger>
          <TabsTrigger value="attachments">Allegati ({c.attachments.length})</TabsTrigger>
          <TabsTrigger value="links">Link ({c.links.length})</TabsTrigger>
          <TabsTrigger value="people">Persone ({c.people.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="threads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Messaggi</TableHead>
                    <TableHead>Ultima attività</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.threads.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/threads/${encodeURIComponent(t.id)}`} className="hover:underline font-medium">
                          {t.subject_root}
                        </Link>
                      </TableCell>
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
                    <TableHead>Messaggio</TableHead>
                    <TableHead>Responsabile</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data mail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.todos.map((t) => (
                    <TableRow key={t.id} className={t.done ? 'opacity-60' : ''}>
                      <TableCell className="max-w-[420px] truncate">{t.text}</TableCell>
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Dimensione</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.attachments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[320px] truncate font-medium">{a.filename}</TableCell>
                      <TableCell className="text-xs">{a.mime}</TableCell>
                      <TableCell className="text-xs">{formatBytes(a.size)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{a.mail_subject}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{shortDate(a.mail_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Contesto</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.links.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <a href={l.url} target="_blank" rel="noopener" className="hover:underline text-sky-300 truncate block max-w-[320px]">
                          {l.url}
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{l.context}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{l.mail_subject}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{shortDate(l.mail_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="people">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mail count</TableHead>
                    <TableHead>Ultima attività</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.people.map((p) => (
                    <TableRow key={p.email}>
                      <TableCell className="font-medium">{p.name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{p.email}</TableCell>
                      <TableCell>{p.email_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{relativeItalian(p.last_seen)}</TableCell>
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
