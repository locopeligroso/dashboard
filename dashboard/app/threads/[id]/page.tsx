import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getThread } from '@/lib/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { formatBytes, relativeItalian, shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params

  const id = decodeURIComponent(p.id)
  const d = getThread(id)
  if (!d) notFound()

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/threads" className="text-xs text-muted-foreground hover:text-foreground">← Conversazioni</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{d.thread.subject_root}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {d.thread.company_domain ? (
            <Link href={`/clients/${encodeURIComponent(d.thread.company_domain)}`} className="text-xs text-muted-foreground hover:underline">
              {d.thread.company_domain}
            </Link>
          ) : null}
          {d.client?.category ? <CategoryBadge category={d.client.category} /> : null}
          <Badge variant="slate">{d.thread.status}</Badge>
          <span className="text-xs text-muted-foreground">{d.thread.message_count} messaggi</span>
        </div>
      </header>

      <Tabs defaultValue="mails" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mails">Messaggi ({d.mails.length})</TabsTrigger>
          <TabsTrigger value="tasks">Task ({d.todos.length})</TabsTrigger>
          <TabsTrigger value="attachments">Allegati ({d.attachments.length})</TabsTrigger>
          <TabsTrigger value="links">Link ({d.links.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mails">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mittente</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.mails.map((m) => (
                    <TableRow key={m.uid}>
                      <TableCell>
                        <div className="text-sm font-medium">{m.from_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{m.from_email}</div>
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate">{m.subject}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{shortDate(m.date)}</TableCell>
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
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.todos.map((t) => (
                    <TableRow key={t.id} className={t.done ? 'opacity-60' : ''}>
                      <TableCell className="max-w-[420px]">{t.text}</TableCell>
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
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.attachments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium max-w-[320px] truncate">{a.filename}</TableCell>
                      <TableCell className="text-xs">{a.mime}</TableCell>
                      <TableCell className="text-xs">{formatBytes(a.size)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]">{a.mail_subject}</TableCell>
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
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.links.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <a href={l.url} target="_blank" rel="noopener" className="hover:underline text-sky-300 truncate block max-w-[320px]">{l.url}</a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]">{l.context}</TableCell>
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
