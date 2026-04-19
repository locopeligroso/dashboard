import { listThreads } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThreadsTable } from '@/components/threads-table'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; category?: string }>
}) {
  const sp = await searchParams
  const category = sp.category ?? 'client'
  const rows = listThreads({
    clientDomain: sp.client,
    category,
    limit: 500,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Conversazioni</h1>
        <p className="text-sm text-muted-foreground">
          Default: solo thread da clienti. Click una colonna per ordinare. Aggiungi <code className="text-xs">?category=all</code> per vedere tutti.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Elenco ({rows.length})</CardTitle>
          <CardDescription>Ordinato di default per data ultima attività (più recente in alto)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ThreadsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
