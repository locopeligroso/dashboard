import Link from 'next/link'
import { listProjects } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { relativeItalian } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string }>
}) {
  const sp = await searchParams
  const rows = listProjects({ clientDomain: sp.client, status: sp.status })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Progetti</h1>
        <p className="text-sm text-muted-foreground">Ogni cliente ha almeno un progetto. Thread e mail sono raggruppati per progetto.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Elenco ({rows.length})</CardTitle>
          <CardDescription>Ordinati per ultima attività nel progetto</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Progetto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Thread</TableHead>
                <TableHead>Task aperti</TableHead>
                <TableHead>Ultima attività</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground">#{p.id}</TableCell>
                  <TableCell>
                    <Link href={`/projects/${p.id}`} className="hover:underline font-medium">
                      {p.name}
                    </Link>
                    {p.notes ? <div className="text-xs text-muted-foreground truncate max-w-[280px]">{p.notes}</div> : null}
                  </TableCell>
                  <TableCell>
                    <Link href={`/clients/${encodeURIComponent(p.client_domain)}`} className="hover:underline">
                      <div className="flex flex-col gap-1">
                        <CategoryBadge category={p.client_category} />
                        <span className="text-xs text-muted-foreground">{p.client_name ?? p.client_domain}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'active' ? 'emerald' : p.status === 'paused' ? 'amber' : 'slate'}>
                      {p.status === 'active' ? 'Attivo' : p.status === 'paused' ? 'Pausa' : p.status === 'done' ? 'Completato' : 'Archiviato'}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.thread_count}</TableCell>
                  <TableCell>
                    <Badge variant={(p.todo_open_count ?? 0) > 0 ? 'amber' : 'slate'}>{p.todo_open_count ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relativeItalian(p.last_activity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
