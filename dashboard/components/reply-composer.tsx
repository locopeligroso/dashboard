'use client'
import * as React from 'react'
import { Reply, ReplyAll, Paperclip, Send, Wand2, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Props {
  mailUid: number
  originalSubject: string
  originalFrom: string
  originalTo?: string[]
  originalCc?: string[]
  threadId?: string | null
  clientDomain?: string | null
  onSent?: () => void
}

interface FileInline {
  name: string
  type: string
  size: number
  b64: string
}

function readAsBase64(f: File): Promise<FileInline> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = (reader.result as string) || ''
      const b64 = res.split(',')[1] ?? ''
      resolve({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, b64 })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(f)
  })
}

export function ReplyComposer(props: Props) {
  const [open, setOpen] = React.useState(false)
  const [replyAll, setReplyAll] = React.useState(false)
  const [to, setTo] = React.useState('')
  const [cc, setCc] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [files, setFiles] = React.useState<FileInline[]>([])
  const [busy, setBusy] = React.useState(false)
  const [rephrasing, setRephrasing] = React.useState(false)
  const [result, setResult] = React.useState<'ok' | 'error' | null>(null)
  const [errMsg, setErrMsg] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  function reset(mode: 'simple' | 'all') {
    setReplyAll(mode === 'all')
    setTo(props.originalFrom)
    const others = [...(props.originalTo ?? []), ...(props.originalCc ?? [])]
      .filter((e) => e.toLowerCase() !== props.originalFrom.toLowerCase())
    setCc(mode === 'all' ? others.join(', ') : '')
    const prefix = /^\s*re\s*:/i.test(props.originalSubject) ? '' : 'Re: '
    setSubject(prefix + props.originalSubject)
    setBody('')
    setFiles([])
    setResult(null)
    setErrMsg('')
  }

  async function addFiles(list: FileList | null) {
    if (!list || !list.length) return
    const added: FileInline[] = []
    for (const f of Array.from(list)) {
      if (f.size > 15 * 1024 * 1024) {
        setErrMsg(`File ${f.name} troppo grande (>15 MB)`)
        continue
      }
      added.push(await readAsBase64(f))
    }
    setFiles((prev) => [...prev, ...added])
  }

  async function rephrase() {
    if (!body.trim() || rephrasing) return
    setRephrasing(true)
    try {
      const res = await fetch('/dashboard/api/napoleon/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: body,
          context: `Risposta a mail da ${props.originalFrom}, oggetto: ${props.originalSubject}. Cliente: ${props.clientDomain ?? '—'}.`,
          tone: 'professionale, cortese, sintetico, italiano',
        }),
      })
      const data = await res.json()
      if (res.ok && data?.content) setBody(data.content)
    } catch (e: any) {
      setErrMsg(String(e?.message ?? e))
    } finally {
      setRephrasing(false)
    }
  }

  async function send() {
    if (busy) return
    setBusy(true)
    setResult(null)
    setErrMsg('')
    try {
      const toList = to.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean)
      const ccList = cc.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean)
      const res = await fetch(`/dashboard/api/mails/${props.mailUid}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: toList,
          cc: ccList.length ? ccList : undefined,
          subject,
          text: body,
          attachments: files.map((f) => ({ filename: f.name, content_base64: f.b64, contentType: f.type })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'errore invio')
      setResult('ok')
      props.onSent?.()
      setTimeout(() => setOpen(false), 1500)
    } catch (e: any) {
      setResult('error')
      setErrMsg(String(e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(replyAll ? 'all' : 'simple') }}>
      <div className="inline-flex items-center gap-1">
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" onClick={() => { setReplyAll(false); reset('simple'); setOpen(true) }}>
            <Reply className="h-4 w-4" />
            <span className="ml-1">Rispondi</span>
          </Button>
        </SheetTrigger>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" onClick={() => { setReplyAll(true); reset('all'); setOpen(true) }}>
            <ReplyAll className="h-4 w-4" />
            <span className="ml-1">Rispondi a tutti</span>
          </Button>
        </SheetTrigger>
      </div>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{replyAll ? 'Rispondi a tutti' : 'Rispondi'}</SheetTitle>
          <SheetDescription>Mail originale: {props.originalSubject}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 flex-1 overflow-auto pr-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">A (separati da virgola)</label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinatario@..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">CC</label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Oggetto</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Messaggio</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Scrivi la tua risposta..."
              className="w-full min-h-[240px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Allegati ({files.length})</div>
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                    <Paperclip className="h-3 w-3" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result === 'ok' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Messaggio inviato.</AlertDescription>
            </Alert>
          )}
          {result === 'error' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Errore invio: {errMsg}</AlertDescription>
            </Alert>
          )}
        </div>

        <Separator className="my-3" />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            multiple
            ref={fileRef}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Paperclip className="h-4 w-4" />
            <span className="ml-1">Allega</span>
          </Button>
          <Button variant="outline" size="sm" onClick={rephrase} disabled={!body.trim() || rephrasing || busy}>
            {rephrasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            <span className="ml-1">Riformula con Napoleone</span>
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button size="sm" onClick={send} disabled={busy || !to.trim() || !subject.trim() || !body.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-1">Invia</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
