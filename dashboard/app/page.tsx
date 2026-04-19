import Link from 'next/link'
import { ArrowRight, Inbox, ListTodo, MessagesSquare, Paperclip, Link2, Users, CheckCircle2, CircleDashed } from 'lucide-react'
import { getKpi, listClients, listTodos, listRuns, schedulerStatus } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { relativeItalian, shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default function Home() {
  const kpi = getKpi()
  const topClients = listClients({ category: 'client' }).slice(0, 5)
  const urgent = listTodos({ openOnly: true, dueSoon: true, recentOnly: true, category: 'client-only', limit: 8 })
  if (urgent.length < 8) {
    const more = listTodos({ openOnly: true, recentOnly: true, category: 'client-only', limit: 8 - urgent.length })
    const seen = new Set(urgent.map((t) => t.id))
    for (const t of more) if (!seen.has(t.id)) urgent.push(t)
  }
  const runs = listRuns(8)
  const sched = schedulerStatus()

  const KPI: Array<{ key: string; label: string; value: number; icon: any; href: string }> = [
    { key: 'mails', label: 'Mail indicizzate', value: kpi.mails, icon: Inbox, href: '/threads' },
    { key: 'threads', label: 'Conversazioni attive', value: kpi.threads_open, icon: MessagesSquare, href: '/threads' },
    { key: 'todos', label: 'Task aperti', value: kpi.todos_open, icon: ListTodo, href: '/tasks' },
    { key: 'clients', label: 'Clienti attivi', value: kpi.active_clients, icon: Users, href: '/clients' },
    { key: 'attach', label: 'Allegati', value: kpi.attachments, icon: Paperclip, href: '/attachments' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Riepilogo</h1>
          <p className="text-sm text-muted-foreground">Panoramica CRM — ultime 2 settimane da clienti attivi</p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {sched.running ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Scheduler attivo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CircleDashed className="h-3 w-3" /> Scheduler fermo
            </span>
          )}
          {sched.last_run?.ran_at ? <span>· ultimo run {relativeItalian(sched.last_run.ran_at)}</span> : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {KPI.map(({ key, label, value, icon: Icon, href }) => (
          <Link key={key} href={href}>
            <Card className="hover:bg-accent/30 transition-colors">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">{value.toLocaleString('it-IT')}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Clienti attivi</CardTitle>
                <CardDescription>Conversazioni recenti da clienti categorizzati</CardDescription>
              </div>
              <Link href="/clients" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Conversazioni aperte</TableHead>
                  <TableHead>Ultima attività</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Nessun cliente attivo. Categorizza domini da <Link className="underline" href="/clients">/clienti</Link>.
                    </TableCell>
                  </TableRow>
                ) : (
                  topClients.map((c) => (
                    <TableRow key={c.domain}>
                      <TableCell>
                        <Link href={`/clients/${encodeURIComponent(c.domain)}`} className="hover:underline">
                          <div className="font-medium truncate max-w-[240px]">{c.name ?? c.domain}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.domain}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.open_threads > 0 ? 'emerald' : 'slate'}>{c.open_threads}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{relativeItalian(c.last_seen)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Task urgenti</CardTitle>
                <CardDescription>Task aperti da clienti — priorità alta</CardDescription>
              </div>
              <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Tutti i task <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Messaggio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Nessun task urgente.
                    </TableCell>
                  </TableRow>
                ) : (
                  urgent.slice(0, 8).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[320px]">
                        <div className="truncate text-sm">{t.text}</div>
                      </TableCell>
                      <TableCell>
                        {t.client_domain ? (
                          <div className="flex flex-col gap-1">
                            <CategoryBadge category={t.category} />
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{t.client_domain}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.mail_date ? relativeItalian(t.mail_date) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Esecuzioni recenti</CardTitle>
            <CardDescription>Scheduler mail-index — ogni 5 minuti</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>+Mail</TableHead>
                  <TableHead>+Task</TableHead>
                  <TableHead>+Allegati</TableHead>
                  <TableHead>+Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{shortDate(r.ran_at)} · {relativeItalian(r.ran_at)}</TableCell>
                    <TableCell>{r.mails_added}</TableCell>
                    <TableCell>{r.todos_added}</TableCell>
                    <TableCell>{r.attachments_added}</TableCell>
                    <TableCell>{r.links_added}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
