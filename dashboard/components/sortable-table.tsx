'use client'
import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T | string
  header: string
  className?: string
  sortable?: boolean
  accessor?: (row: T) => any
  render?: (row: T) => React.ReactNode
}

export interface SortableTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  rowClassName?: (row: T) => string
}

export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nessun dato.',
  initialSort,
  rowClassName,
}: SortableTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.accessor ?? ((r: T) => (r as any)[col.key as string])
    const arr = [...rows]
    arr.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return va - vb
      return String(va).localeCompare(String(vb), 'it', { numeric: true, sensitivity: 'base' })
    })
    if (sort.dir === 'desc') arr.reverse()
    return arr
  }, [rows, sort, columns])

  function toggle(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' }
      if (cur.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => {
            const active = sort?.key === c.key
            const Icon = active ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
            return (
              <TableHead key={String(c.key)} className={cn(c.className)}>
                {c.sortable === false ? (
                  <span>{c.header}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(String(c.key))}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.header}
                    <Icon className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
                  </button>
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground py-8">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          sorted.map((r) => (
            <TableRow key={rowKey(r)} className={rowClassName?.(r)}>
              {columns.map((c) => {
                const content = c.render ? c.render(r) : (c.accessor ? c.accessor(r) : (r as any)[c.key as string])
                return (
                  <TableCell key={String(c.key)} className={c.className}>
                    {content as any}
                  </TableCell>
                )
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
