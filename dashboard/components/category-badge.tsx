import { Badge } from '@/components/ui/badge'
import type { Category } from '@/lib/types'

const LABELS: Record<Category, string> = {
  client: 'Cliente',
  vendor: 'Fornitore',
  award: 'Bando',
  newsletter: 'Newsletter',
  internal: 'Interno',
  unknown: 'Da valutare',
}

const VARIANTS: Record<Category, 'emerald' | 'sky' | 'violet' | 'slate' | 'amber' | 'default'> = {
  client: 'emerald',
  vendor: 'sky',
  award: 'violet',
  newsletter: 'slate',
  internal: 'amber',
  unknown: 'default',
}

export function CategoryBadge({ category }: { category: Category | null | undefined }) {
  const k: Category = (category as Category) ?? 'unknown'
  return <Badge variant={VARIANTS[k]}>{LABELS[k]}</Badge>
}

export const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = (
  ['client', 'vendor', 'award', 'newsletter', 'internal', 'unknown'] as Category[]
).map((c) => ({ value: c, label: LABELS[c] }))
