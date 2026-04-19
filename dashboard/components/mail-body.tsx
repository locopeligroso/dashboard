'use client'
import * as React from 'react'
import { Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  uid: number
  subject?: string
  autoLoad?: boolean
}

interface Body {
  uid: number
  text: string | null
  html: string | null
  text_raw: string | null
  html_raw: string | null
  text_clean: string | null
  html_clean: string | null
  from_cache?: boolean
}

export function MailBody({ uid, subject, autoLoad = true }: Props) {
  const [body, setBody] = React.useState<Body | null>(null)
  const [loading, setLoading] = React.useState(autoLoad)
  const [error, setError] = React.useState<string | null>(null)
  const [showRaw, setShowRaw] = React.useState(false)

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

  const cleanTxt = body?.text_clean ?? ''
  const cleanHtm = body?.html_clean ?? ''
  const autoFallback = (cleanTxt.trim().length < 30 && cleanHtm.trim().length < 30)
  const effectiveShowRaw = showRaw || autoFallback
  const renderHtml = effectiveShowRaw ? body?.html_raw : body?.html_clean
  const renderText = effectiveShowRaw ? body?.text_raw : body?.text_clean

  const srcDoc = React.useMemo(() => {
    if (!renderHtml) return null
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
    return `<!doctype html><html><head>${style}<base target="_blank"></head><body>${renderHtml}</body></html>`
  }, [renderHtml])

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

  if (loading) {
    return (
      <div className="space-y-2 px-3 py-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-rose-300 px-3 py-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Errore: {error}</span>
      </div>
    )
  }

  if (!body || (!renderHtml && !renderText)) {
    // If clean version is empty but raw has content, offer to show raw
    const rawHas = body && (body.html_raw || body.text_raw)
    if (rawHas && !showRaw) {
      return (
        <div className="px-3 py-3 space-y-2 text-xs text-muted-foreground">
          <div>Il corpo pulito è vuoto (probabilmente era solo un inoltro/firma).</div>
          <Button variant="outline" size="sm" onClick={() => setShowRaw(true)}>
            <Eye className="h-3 w-3 mr-1" /> Mostra corpo completo
          </Button>
        </div>
      )
    }
    return (
      <div className="text-xs text-muted-foreground italic px-3 py-3">
        Contenuto non ancora disponibile.
      </div>
    )
  }

  const toggle = (
    <div className="flex items-center justify-end px-3 pt-2 pb-1 border-b border-border/30">
      <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)} className="text-xs">
        {showRaw ? (
          <><EyeOff className="h-3 w-3 mr-1" /> Nascondi inoltri/firme</>
        ) : (
          <><Eye className="h-3 w-3 mr-1" /> Mostra messaggio completo</>
        )}
      </Button>
    </div>
  )

  if (srcDoc) {
    return (
      <div>
        {toggle}
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
    <div>
      {toggle}
      <pre className="whitespace-pre-wrap text-sm text-foreground/95 font-sans leading-relaxed px-3 py-3">
        {renderText}
      </pre>
    </div>
  )
}
