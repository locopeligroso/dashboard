'use client'
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORY_OPTIONS } from './category-badge'

export function ClientsFilter() {
  const router = useRouter()
  const sp = useSearchParams()
  const [category, setCategory] = React.useState(sp.get('category') ?? 'all')
  const [search, setSearch] = React.useState(sp.get('search') ?? '')

  function apply(next: { category?: string; search?: string }) {
    const params = new URLSearchParams(Array.from(sp.entries()))
    const cat = next.category ?? category
    const q = next.search ?? search
    if (cat && cat !== 'all') params.set('category', cat)
    else params.delete('category')
    if (q) params.set('search', q)
    else params.delete('search')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      <Select
        value={category}
        onValueChange={(v) => {
          setCategory(v)
          apply({ category: v })
        }}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Tutte le categorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le categorie</SelectItem>
          {CATEGORY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Cerca dominio o nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply({ search: (e.target as HTMLInputElement).value })
        }}
        className="h-8 w-64 text-xs"
      />
    </div>
  )
}
