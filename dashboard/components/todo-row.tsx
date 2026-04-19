'use client'
import * as React from 'react'
import { Check, Clock, User, AlertTriangle } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from './category-badge'
import { relativeItalian } from '@/lib/utils'
import type { Todo } from '@/lib/types'

const OWNERS: Array<{ value: string; label: string }> = [
  { value: 'giuseppe', label: 'Giuseppe' },
  { value: 'team', label: 'Team' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'shared', label: 'Condiviso' },
]

export function TodoRow({ todo }: { todo: Todo }) {
  const [done, setDone] = React.useState<boolean>(!!todo.done)
  const [owner, setOwner] = React.useState<string>(todo.owner || 'giuseppe')
  const [busy, setBusy] = React.useState(false)

  async function toggleDone() {
    setBusy(true)
    try {
      const res = await fetch(`/dashboard/api/todos/${todo.id}/done`, { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as { done: number }
        setDone(!!data.done)
      }
    } finally {
      setBusy(false)
    }
  }

  async function changeOwner(next: string) {
    setOwner(next)
    await fetch(`/dashboard/api/todos/${todo.id}/owner`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: next }),
    })
  }

  const urgent = todo.deadline && new Date(todo.deadline) <= new Date(Date.now() + 7 * 864e5)
  const overdue = todo.deadline && new Date(todo.deadline) < new Date()

  return (
    <TableRow className={done ? 'opacity-50' : ''}>
      <TableCell className="w-10">
        <Checkbox checked={done} onCheckedChange={toggleDone} disabled={busy} aria-label="Segna come fatto" />
      </TableCell>
      <TableCell className="max-w-[420px]">
        <div className={`text-sm ${done ? 'line-through' : ''}`}>{todo.text}</div>
        {todo.mail_subject ? (
          <div className="text-xs text-muted-foreground truncate mt-1">{todo.mail_subject}</div>
        ) : null}
      </TableCell>
      <TableCell>
        {todo.client_domain ? (
          <div className="flex items-center gap-2">
            <CategoryBadge category={todo.category} />
            <span className="text-xs text-muted-foreground truncate">{todo.client_domain}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {todo.deadline ? (
          <Badge variant={overdue ? 'rose' : urgent ? 'amber' : 'slate'}>
            {overdue ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
            {todo.deadline}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {todo.mail_date ? relativeItalian(todo.mail_date) : '—'}
          </span>
        )}
      </TableCell>
      <TableCell className="w-[140px]">
        <Select value={owner} onValueChange={changeOwner}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OWNERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {o.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  )
}
