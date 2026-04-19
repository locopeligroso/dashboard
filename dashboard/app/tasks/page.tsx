import { listTodos } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TasksFilter } from '@/components/tasks-filter'
import { TodoRow } from '@/components/todo-row'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; category?: string; open?: string; dueSoon?: string }>
}) {
  const sp = await searchParams
  const todos = listTodos({
    owner: sp.owner,
    category: sp.category ?? 'client-only',
    openOnly: sp.open !== '0',
    dueSoon: sp.dueSoon === '1',
    recentOnly: true,
    limit: 300,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Task</h1>
        <p className="text-sm text-muted-foreground">
          Azioni estratte dalle mail dei clienti degli ultimi 14 giorni. Aggiornate ogni 5 minuti.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Task estratti ({todos.length})</CardTitle>
          <CardDescription>Assegna il responsabile, spunta quando concluso. Default: solo clienti.</CardDescription>
        </CardHeader>
        <CardContent>
          <TasksFilter />
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
              {todos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                    Nessun task corrisponde ai filtri selezionati.
                  </td>
                </tr>
              ) : (
                todos.map((t) => <TodoRow key={t.id} todo={t} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
