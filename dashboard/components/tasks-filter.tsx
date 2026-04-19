'use client'
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const OWNERS = [
  { value: 'all', label: 'Tutti i responsabili' },
  { value: 'giuseppe', label: 'Giuseppe' },
  { value: 'team', label: 'Team' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'shared', label: 'Condiviso' },
]

const CATEGORIES = [
  { value: 'client-only', label: 'Solo clienti' },
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'vendor', label: 'Fornitori' },
  { value: 'unknown', label: 'Da valutare' },
]

export function TasksFilter() {
  const router = useRouter()
  const sp = useSearchParams()
  const owner = sp.get('owner') ?? 'all'
  const category = sp.get('category') ?? 'client-only'
  const openOnly = sp.get('open') !== '0'
  const dueSoon = sp.get('dueSoon') === '1'

  function set(key: string, v: string | null) {
    const params = new URLSearchParams(Array.from(sp.entries()))
    if (v === null) params.delete(key)
    else params.set(key, v)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      <Select value={owner} onValueChange={(v) => set('owner', v === 'all' ? null : v)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OWNERS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={category} onValueChange={(v) => set('category', v)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={openOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => set('open', openOnly ? '0' : '1')}
      >
        Solo aperti
      </Button>
      <Button
        variant={dueSoon ? 'default' : 'outline'}
        size="sm"
        onClick={() => set('dueSoon', dueSoon ? null : '1')}
      >
        Urgenti
      </Button>
    </div>
  )
}
