import Link from 'next/link'
import { listTodos } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { TasksFilter } from '@/components/tasks-filter'
import { TodoRow } from '@/components/todo-row'
import type { Todo } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; category?: string; open?: string; dueSoon?: string; group?: string }>
}) {
  const sp = await searchParams
  const groupBy = sp.group ?? 'client' // 'client' | 'none'
  const todos = listTodos({
    owner: sp.owner,
    category: sp.category ?? 'client-only',
    openOnly: sp.open !== '0',
    dueSoon: sp.dueSoon === '1',
    recentOnly: true,
    limit: 500,
  })

  // Group by client_domain
  const groups = new Map<string, { client_domain: string; todos: Todo[]; category: string | null }>()
  for (const t of todos) {
    const key = t.client_domain ?? '—'
    let g = groups.get(key)
    if (!g) {
      g = { client_domain: key, todos: [], category: t.category ?? null }
      groups.set(key, g)
    }
    g.todos.push(t)
  }
  const groupList = Array.from(groups.values()).sort((a, b) => b.todos.length - a.todos.length)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Task</h1>
        <p className="text-sm text-muted-foreground">
          Azioni estratte dalle mail clienti degli ultimi 14 giorni (filtro selettivo v3). Raggruppati per cliente.
        </p>
      </header>

      <TasksFilter />

      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">{todos.length} task in {groupList.length} clienti</span>
        <span className="text-muted-foreground">·</span>
        <Link href={`?group=${groupBy === 'client' ? 'none' : 'client'}${sp.owner ? `&owner=${sp.owner}` : ''}${sp.dueSoon ? '&dueSoon=1' : ''}`} className="underline hover:text-foreground">
          {groupBy === 'client' ? 'Vista piatta' : 'Raggruppa per cliente'}
        </Link>
      </div>

      {groupBy === 'client' ? (
        <div className="space-y-4">
          {groupList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Nessun task.</CardContent>
            </Card>
          ) : (
            groupList.map((g) => (
              <Card key={g.client_domain}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CategoryBadge category={(g.category as any) ?? 'unknown'} />
                    {g.client_domain !== '—' ? (
                      <Link href={`/clients/${encodeURIComponent(g.client_domain)}`} className="font-medium hover:underline">
                        {g.client_domain}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Senza cliente</span>
                    )}
                    <Badge variant="amber">{g.todos.length} task</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Messaggio</TableHead>
                        <TableHead>Conversazione</TableHead>
                        <TableHead>Scadenza / Data</TableHead>
                        <TableHead>Responsabile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.todos.map((t) => (
                        <TodoRow key={t.id} todo={t} />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Messaggio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Scadenza / Data</TableHead>
                  <TableHead>Responsabile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((t) => (
                  <TodoRow key={t.id} todo={t} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
