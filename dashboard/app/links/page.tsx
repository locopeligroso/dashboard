import Link from 'next/link'
import { listLinks, topLinkDomains } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { shortDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ domain?: string; search?: string }> }) {
  const sp = await searchParams

  const top = topLinkDomains(10)
  const rows = listLinks({ domain: sp.domain, search: sp.search, limit: 300 })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Link</h1>
        <p className="text-sm text-muted-foreground">URL estratti dalle mail, raggruppati per dominio.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 domini</CardTitle>
          <CardDescription>I domini più linkati nelle mail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {top.map((d) => (
              <Link key={d.domain} href={`/links?domain=${encodeURIComponent(d.domain)}`}>
                <Badge variant={sp.domain === d.domain ? 'emerald' : 'slate'} className="cursor-pointer">
                  {d.domain} · {d.count}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>URL ({rows.length})</CardTitle>
          <CardDescription>Usa ?domain=xxx per filtrare</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Oggetto</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <a href={l.url} target="_blank" rel="noopener" className="hover:underline text-sky-300 truncate block max-w-[380px]">
                      {l.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    {l.client_domain ? (
                      <div className="flex flex-col gap-1">
                        <CategoryBadge category={l.category} />
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">{l.client_domain}</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]">{l.mail_subject}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{shortDate(l.mail_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
