'use client'
import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORY_OPTIONS } from './category-badge'
import type { Category } from '@/lib/types'

export function ClientCategorySelect({
  domain,
  value,
}: {
  domain: string
  value: Category
}) {
  const [category, setCategory] = React.useState<Category>(value)
  const [busy, setBusy] = React.useState(false)

  async function update(next: string) {
    setBusy(true)
    setCategory(next as Category)
    try {
      await fetch(`/dashboard/api/clients/${encodeURIComponent(domain)}/category`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: next }),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Select value={category} onValueChange={update} disabled={busy}>
      <SelectTrigger className="h-8 w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
