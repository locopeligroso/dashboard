import Link from 'next/link'
import { listClients } from '@/lib/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { ClientsFilter } from '@/components/clients-filter'
import { relativeItalian } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) {
  const sp = await searchParams

  const rows = listClients({ category: sp.category, search: sp.search })
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Clienti</h1>
        <p className="text-sm text-muted-foreground">Domini categorizzati — clienti, fornitori, bandi, newsletter, interni</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Elenco domini ({rows.length})</CardTitle>
          <CardDescription>Categorizza i domini per filtrare task e conversazioni rilevanti</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsFilter />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dominio</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Mail</TableHead>
                <TableHead>Conversazioni aperte</TableHead>
                <TableHead>Conversazioni totali</TableHead>
                <TableHead>Ultima attività</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.domain}>
                  <TableCell>
                    <Link href={`/clients/${encodeURIComponent(c.domain)}`} className="hover:underline">
                      <div className="font-medium">{c.name ?? c.domain}</div>
                      <div className="text-xs text-muted-foreground">{c.domain}</div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={c.category} />
                  </TableCell>
                  <TableCell className="text-sm">{c.email_count}</TableCell>
                  <TableCell>
                    <Badge variant={c.open_threads > 0 ? 'emerald' : 'slate'}>{c.open_threads}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{c.thread_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relativeItalian(c.last_seen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
