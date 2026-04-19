'use client'
import * as React from 'react'
import { MessageSquare, Send, Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { ChatMessage, EntityType } from '@/lib/types'

interface ChatSheetProps {
  entityType: EntityType
  entityId: string
  label?: string
  clientDomain?: string | null
  projectName?: string | null
  triggerClass?: string
  triggerVariant?: 'outline' | 'ghost' | 'default' | 'secondary'
  triggerSize?: 'sm' | 'default' | 'icon'
  iconOnly?: boolean
}

export function ChatSheet(props: ChatSheetProps) {
  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [rephrasing, setRephrasing] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    fetch(
      `/dashboard/api/chat/${props.entityType}/${encodeURIComponent(props.entityId)}`,
      { cache: 'no-store' },
    )
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data?.messages) ? data.messages : []))
      .catch(() => {})
  }, [open, props.entityType, props.entityId])

  async function send() {
    if (!input.trim() || busy) return
    setBusy(true)
    const mine = input.trim()
    setInput('')
    setMessages((m) => [
      ...m,
      { id: Math.random(), chat_thread_id: 0, role: 'user', content: mine, status: 'ok', error: null, created_at: new Date().toISOString() } as ChatMessage,
      { id: Math.random(), chat_thread_id: 0, role: 'napoleon', content: 'Napoleone sta rispondendo…', status: 'pending', error: null, created_at: new Date().toISOString() } as ChatMessage,
    ])
    try {
      const res = await fetch(
        `/dashboard/api/chat/${props.entityType}/${encodeURIComponent(props.entityId)}/send`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: mine,
            entity_label: props.label,
            client_domain: props.clientDomain ?? null,
            project_name: props.projectName ?? null,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'errore')
      setMessages((m) => {
        const next = m.slice(0, -1)
        next.push({
          id: data.napoleon_message_id ?? Math.random(),
          chat_thread_id: data.chat_thread_id,
          role: 'napoleon',
          content: data.content ?? '',
          status: 'ok',
          error: null,
          created_at: new Date().toISOString(),
        } as ChatMessage)
        return next
      })
    } catch (e: any) {
      setMessages((m) => {
        const next = m.slice(0, -1)
        next.push({
          id: Math.random(),
          chat_thread_id: 0,
          role: 'napoleon',
          content: `(errore: ${String(e?.message ?? e)})`,
          status: 'error',
          error: String(e?.message ?? e),
          created_at: new Date().toISOString(),
        } as ChatMessage)
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  async function rephrase() {
    if (!input.trim() || rephrasing) return
    setRephrasing(true)
    try {
      const res = await fetch('/dashboard/api/napoleon/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: input,
          context: `Riformula per chat interna contestualizzata su ${props.entityType}=${props.entityId}. Cliente: ${props.clientDomain ?? '—'}.`,
          tone: 'diretto, operativo, professionale',
        }),
      })
      const data = await res.json()
      if (res.ok && data?.content) setInput(data.content)
    } catch {}
    finally {
      setRephrasing(false)
    }
  }

  const Trigger = (
    <Button
      variant={props.triggerVariant ?? 'outline'}
      size={props.triggerSize ?? 'sm'}
      className={props.triggerClass}
      aria-label="Chat con Napoleone"
    >
      <MessageSquare className="h-4 w-4" />
      {!props.iconOnly && <span className="ml-1">Chiedi a Napoleone</span>}
    </Button>
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{Trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Chat con Napoleone</SheetTitle>
          <SheetDescription>
            Contesto: <code className="text-xs">{props.entityType}</code> · {props.label ?? props.entityId}
          </SheetDescription>
        </SheetHeader>
        <Separator className="my-3" />
        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center">
                Nessun messaggio. Scrivi la prima richiesta a Napoleone sotto.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm'
                        : 'max-w-[85%] rounded-lg bg-muted text-foreground px-3 py-2 text-sm whitespace-pre-wrap'
                    }
                  >
                    <div className="text-xs opacity-60 mb-1">{m.role === 'user' ? 'Tu' : 'Napoleone'}</div>
                    {m.status === 'pending' ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> {m.content || 'attendere...'}
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <Separator className="my-3" />
        <div className="space-y-2">
          <textarea
            className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Scrivi a Napoleone..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={rephrase} disabled={!input.trim() || rephrasing || busy}>
              {rephrasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              <span className="ml-1">Riformula</span>
            </Button>
            <div className="flex-1" />
            <Button onClick={send} disabled={!input.trim() || busy} size="sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-1">Invia</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
