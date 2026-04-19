'use client'
import * as React from 'react'
import { Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  uid: number
  subject?: string
  /** Auto-load body on mount (default: true). If false, user clicks to expand. */
  autoLoad?: boolean
}

interface Body {
  uid: number
  text: string | null
  html: string | null
  from_cache?: boolean
}

export function MailBody({ uid, subject, autoLoad = true }: Props) {
  const [body, setBody] = React.useState<Body | null>(null)
  const [loading, setLoading] = React.useState(autoLoad)
  const [error, setError] = React.useState<string | null>(null)
  const [showQuoted, setShowQuoted] = React.useState(false)

  React.useEffect(() => {
    if (!autoLoad) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/dashboard/api/mails/${uid}/body`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'errore fetch')
        if (!cancelled) setBody(data)
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid, autoLoad])

  // Split quoted text (lines starting with ">") from the rest — show hidden behind a toggle
  const { visible, quoted } = React.useMemo(() => {
    if (!body?.text) return { visible: '', quoted: '' }
    const lines = body.text.split('\n')
    const out: string[] = []
    const q: string[] = []
    let inQuote = false
    for (const l of lines) {
      if (/^\s*>/.test(l) || /^(On |Il |Le |From |Da |Sent |Inviato )/.test(l.trim())) {
        inQuote = true
      }
      if (inQuote) q.push(l)
      else out.push(l)
    }
    return { visible: out.join('\n').trim(), quoted: q.join('\n').trim() }
  }, [body?.text])

  const srcDoc = React.useMemo(() => {
    if (!body?.html) return null
    const style = `<style>
      *{box-sizing:border-box;max-width:100%}
      body{font:14px/1.6 -apple-system,BlinkMacSystemFont,system-ui,Segoe UI,sans-serif;color:#e2e8f0;background:transparent;margin:0;padding:16px 20px;}
      p{margin:0 0 12px 0}
      a{color:#7dd3fc;text-decoration:underline;text-decoration-color:rgba(125,211,252,.35);text-underline-offset:2px}
      a:hover{text-decoration-color:#7dd3fc}
      img{height:auto;border-radius:4px}
      blockquote{border-left:2px solid #475569;padding:4px 14px;margin:8px 0;color:#94a3b8;font-size:13px}
      pre,code{background:#0f172a;padding:2px 6px;border-radius:3px;font-family:ui-monospace,monospace;font-size:12px}
      pre{padding:10px 14px;white-space:pre-wrap;overflow:auto}
      table{border-collapse:collapse;margin:8px 0}
      td,th{border:1px solid #334155;padding:6px 10px;vertical-align:top}
      hr{border:0;border-top:1px solid #334155;margin:16px 0}
      h1,h2,h3,h4{margin:16px 0 8px 0;color:#f1f5f9;font-weight:600}
      ul,ol{margin:8px 0 12px 24px;padding:0}
      li{margin:4px 0}
    </style>`
    return `<!doctype html><html><head>${style}<base target="_blank"></head><body>${body.html}</body></html>`
  }, [body?.html])

  const [iframeHeight, setIframeHeight] = React.useState(200)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const onFrameLoad = React.useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    try {
      const h = Math.min(Math.max(doc.body.scrollHeight + 32, 120), 2400)
      setIframeHeight(h)
    } catch {}
  }, [])

  if (!autoLoad && !body && !loading) {
    return (
      <button
        className="text-xs text-muted-foreground hover:text-foreground underline"
        onClick={() => {
          setLoading(true)
          fetch(`/dashboard/api/mails/${uid}/body`)
            .then((r) => r.json())
            .then(setBody)
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false))
        }}
      >
        Carica il contenuto
      </button>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2 px-1 py-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-10/12" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-rose-300 px-1 py-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Errore: {error}</span>
      </div>
    )
  }

  if (!body || (!body.html && !body.text)) {
    return (
      <div className="text-xs text-muted-foreground italic px-1 py-2">
        Contenuto non ancora disponibile. Verrà scaricato nel prossimo ciclo scheduler.
      </div>
    )
  }

  if (srcDoc) {
    return (
      <div className="overflow-hidden rounded-md">
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin allow-popups"
          srcDoc={srcDoc}
          onLoad={onFrameLoad}
          className="w-full border-0 bg-transparent block"
          style={{ height: iframeHeight }}
          title={subject ?? `Mail UID ${uid}`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 px-1">
      <pre className="whitespace-pre-wrap text-sm text-foreground/95 font-sans leading-relaxed">{visible}</pre>
      {quoted ? (
        <div>
          <button
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowQuoted((v) => !v)}
          >
            {showQuoted ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showQuoted ? 'Nascondi testo citato' : 'Mostra testo citato'}
          </button>
          {showQuoted && (
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground border-l-2 border-border pl-3">{quoted}</pre>
          )}
        </div>
      ) : null}
    </div>
  )
}
