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
  searchParams: Promise<{ mime?: string; client?: string; showSig?: string }>
}) {
  const sp = await searchParams
  const groups = attachmentsByThread({ mime: sp.mime, clientDomain: sp.client })
  const showSig = sp.showSig === '1'

  const filtered = groups
    .map((g) => ({ ...g, attachments: showSig ? g.attachments : g.attachments.filter((a: any) => a.is_inline !== 1) }))
    .filter((g) => g.attachments.length > 0)

  const total = filtered.reduce((acc, g) => acc + g.attachments.length, 0)
  const hiddenSig = groups.reduce((acc, g) => acc + g.attachments.filter((a: any) => a.is_inline === 1).length, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Allegati</h1>
        <p className="text-sm text-muted-foreground">
          File ricevuti via mail, divisi per thread. Anteprima + download. Firme immagine escluse di default.
        </p>
      </header>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{total} file in {filtered.length} conversazioni</span>
        {hiddenSig > 0 && !showSig ? (
          <>
            <span>·</span>
            <Link href="?showSig=1" className="underline hover:text-foreground">Mostra anche {hiddenSig} firme escluse</Link>
          </>
        ) : null}
        {showSig ? <Link href="/attachments" className="underline hover:text-foreground">Nascondi firme</Link> : null}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Nessun allegato.</CardContent>
          </Card>
        ) : (
          filtered.map((g) => (
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
