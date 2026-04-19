'use client'
import * as React from 'react'
import { ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  uid: number
  subject?: string
}

interface Body {
  uid: number
  text: string | null
  html: string | null
  from_cache?: boolean
}

export function MailBody({ uid, subject }: Props) {
  const [open, setOpen] = React.useState(false)
  const [body, setBody] = React.useState<Body | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function load() {
    if (body || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/dashboard/api/mails/${uid}/body`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'errore fetch')
      setBody(data)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const srcDoc = React.useMemo(() => {
    if (!body?.html) return null
    const style = `<style>
      body{font:13px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#e5e7eb;background:transparent;margin:8px;padding:0;}
      a{color:#7dd3fc;}
      img{max-width:100%;height:auto;}
      blockquote{border-left:3px solid #334155;padding-left:8px;color:#94a3b8;}
      pre{white-space:pre-wrap;background:#0f172a;padding:8px;border-radius:4px;}
      table{max-width:100%;border-collapse:collapse;}
      *{max-width:100%;}
    </style>`
    return `<!doctype html><html><head>${style}<base target="_blank"></head><body>${body.html}</body></html>`
  }, [body?.html])

  return (
    <div className="mt-2 border border-border/50 rounded-md overflow-hidden bg-muted/10">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className="w-full justify-start rounded-none border-b border-border/30 hover:bg-accent/30"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3 mr-2" /> : <ChevronRight className="h-3 w-3 mr-2" />}
        {open ? 'Nascondi messaggio' : 'Leggi il messaggio'}
        {body && <span className="ml-auto text-xs text-muted-foreground">UID #{uid}</span>}
      </Button>
      {open && (
        <div className="p-3">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-rose-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>Errore caricamento: {error}</div>
            </div>
          )}
          {!loading && !error && body && (
            <div>
              {srcDoc ? (
                <iframe
                  sandbox="allow-same-origin allow-popups"
                  srcDoc={srcDoc}
                  className="w-full min-h-[300px] max-h-[70vh] border-0 bg-transparent"
                  title={subject ?? `Mail UID ${uid}`}
                />
              ) : body.text ? (
                <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans max-h-[70vh] overflow-auto">{body.text}</pre>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Contenuto non ancora scaricato. Sarà disponibile al prossimo ciclo scheduler.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
