import Link from 'next/link'
import { attachmentsByThread } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { AttachmentPreview } from '@/components/attachment-preview'
import { relativeItalian } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mime?: string; client?: string }>
}) {
  const sp = await searchParams
  const groups = attachmentsByThread({ mime: sp.mime, clientDomain: sp.client })

  const total = groups.reduce((acc, g) => acc + g.attachments.length, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Allegati</h1>
        <p className="text-sm text-muted-foreground">
          File ricevuti via mail, divisi per thread. Clicca anteprima per aprire il file, Download per salvarlo.
        </p>
      </header>

      <div className="text-xs text-muted-foreground">
        {total} file in {groups.length} conversazioni
      </div>

      <div className="space-y-4">
        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Nessun allegato.</CardContent>
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.thread_id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={g.category} />
                      {g.company_domain ? (
                        <Link href={`/clients/${encodeURIComponent(g.company_domain)}`} className="text-xs text-muted-foreground hover:underline">
                          {g.company_domain}
                        </Link>
                      ) : null}
                      {g.project_name ? (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <Link href={`/projects/${g.project_id}`} className="text-xs hover:underline">
                            {g.project_name}
                          </Link>
                        </>
                      ) : null}
                    </div>
                    <CardTitle className="mt-2">
                      {g.thread_id !== 'no-thread' ? (
                        <Link href={`/threads/${encodeURIComponent(g.thread_id)}`} className="hover:underline">
                          {g.subject_root}
                        </Link>
                      ) : (
                        'Senza thread'
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {relativeItalian(g.last_msg_date)} · {g.attachments.length} allegati
                    </CardDescription>
                  </div>
                  <Badge variant="slate">{g.attachments.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.attachments.map((a) => (
                    <AttachmentPreview key={a.id} att={a} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
