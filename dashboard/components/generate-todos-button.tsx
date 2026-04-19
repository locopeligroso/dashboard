'use client'
import * as React from 'react'
import { Wand2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Checkbox } from '@/components/ui/checkbox'

interface ProposedTask {
  text: string
  owner?: 'giuseppe' | 'team' | 'cliente' | 'shared'
  deadline?: string | null
}

interface Props {
  threadId: string
  projectName?: string | null
  onSaved?: (count: number) => void
}

export function GenerateTodosButton({ threadId, projectName, onSaved }: Props) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<string>('')
  const [project, setProject] = React.useState<string>(projectName ?? '')
  const [tasks, setTasks] = React.useState<ProposedTask[]>([])
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [saved, setSaved] = React.useState<{ inserted: number; project_id: number | null } | null>(null)

  async function preview() {
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const res = await fetch(`/dashboard/api/threads/${encodeURIComponent(threadId)}/generate-todos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preview: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'errore')
      const ts: ProposedTask[] = Array.isArray(data.tasks) ? data.tasks : []
      setTasks(ts)
      setSelected(new Set(ts.map((_, i) => i)))
      setSummary(data.summary ?? '')
      setProject(data.project_name ?? projectName ?? '')
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    if (open && tasks.length === 0 && !busy && !error) preview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function save() {
    if (!tasks.length) return
    setSaving(true)
    setError(null)
    try {
      const chosen = tasks.filter((_, i) => selected.has(i))
      // Re-call with save: we override tasks server-side not currently supported; simply call save=true which re-invokes Napoleon.
      // Better: send chosen tasks directly to a lightweight save endpoint. For MVP we call the same with preview=false.
      const res = await fetch(`/dashboard/api/threads/${encodeURIComponent(threadId)}/generate-todos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preview: false, tasks: chosen }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'errore save')
      setSaved({ inserted: data.inserted ?? chosen.length, project_id: data.project_id ?? null })
      onSaved?.(data.inserted ?? chosen.length)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Wand2 className="h-4 w-4" />
          <span className="ml-1">Genera todo</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Napoleone compila la todo list</SheetTitle>
          <SheetDescription>Il Maresciallo legge il thread e suggerisce azioni concrete per Giuseppe.</SheetDescription>
        </SheetHeader>
        <Separator className="my-3" />
        <div className="flex-1 overflow-auto pr-1 space-y-3">
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Napoleone sta analizzando il thread...
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!busy && !error && tasks.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Nessun task emerso dal thread. Napoleone ritiene che non ci siano azioni pendenti per Giuseppe.
            </div>
          )}
          {summary && (
            <div className="text-xs bg-muted/40 rounded p-3">
              <div className="font-medium mb-1">Riepilogo</div>
              <div className="text-muted-foreground">{summary}</div>
            </div>
          )}
          {project && (
            <div className="text-xs">
              <span className="text-muted-foreground">Progetto suggerito:</span>{' '}
              <span className="font-medium">{project}</span>
            </div>
          )}
          <div className="space-y-2">
            {tasks.map((t, i) => {
              const on = selected.has(i)
              return (
                <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => {
                      const next = new Set(selected)
                      if (v) next.add(i)
                      else next.delete(i)
                      setSelected(next)
                    }}
                    aria-label="Seleziona task"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{t.text}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t.owner ?? 'giuseppe'}
                      {t.deadline ? ` · scadenza ${t.deadline}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {saved && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Salvati {saved.inserted} task nel progetto (ID {saved.project_id ?? '—'}).
              </AlertDescription>
            </Alert>
          )}
        </div>
        <Separator className="my-3" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={preview} disabled={busy || saving}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            <span className="ml-1">Rigenera</span>
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Chiudi</Button>
          <Button size="sm" onClick={save} disabled={saving || selected.size === 0 || saved != null}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salva {selected.size} task
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
