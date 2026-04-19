import Link from 'next/link'
import { listThreads } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { relativeItalian } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ client?: string; category?: string }> }) {
  const sp = await searchParams

  const rows = listThreads({
    clientDomain: sp.client,
    category: sp.category,
    limit: 200,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Conversazioni</h1>
        <p className="text-sm text-muted-foreground">Thread aggregati per oggetto + dominio.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Elenco ({rows.length})</CardTitle>
          <CardDescription>Ordinati per ultima attività</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oggetto</TableHead>
                <TableHead>Dominio</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Messaggi</TableHead>
                <TableHead>Ultima attività</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-[360px]">
                    <Link href={`/threads/${encodeURIComponent(t.id)}`} className="hover:underline font-medium truncate block">
                      {t.subject_root}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {t.company_domain ? (
                      <Link href={`/clients/${encodeURIComponent(t.company_domain)}`} className="hover:underline text-xs text-muted-foreground">
                        {t.company_domain}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><CategoryBadge category={t.category} /></TableCell>
                  <TableCell>{t.message_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relativeItalian(t.last_msg_date)}</TableCell>
                  <TableCell><Badge variant="slate">{t.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
