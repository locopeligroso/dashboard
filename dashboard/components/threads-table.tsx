'use client'
import Link from 'next/link'
import { SortableTable, Column } from './sortable-table'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from './category-badge'
import { relativeItalian, shortDate } from '@/lib/utils'
import type { Thread } from '@/lib/types'

export function ThreadsTable({ rows }: { rows: Thread[] }) {
  const columns: Column<Thread>[] = [
    {
      key: 'subject_root',
      header: 'Oggetto',
      accessor: (r) => r.subject_root,
      render: (r) => (
        <Link href={`/threads/${encodeURIComponent(r.id)}`} className="hover:underline font-medium truncate block max-w-[400px]">
          {r.subject_root}
        </Link>
      ),
    },
    {
      key: 'company_domain',
      header: 'Dominio',
      accessor: (r) => r.company_domain ?? '',
      render: (r) =>
        r.company_domain ? (
          <Link href={`/clients/${encodeURIComponent(r.company_domain)}`} className="text-xs text-muted-foreground hover:underline">
            {r.company_domain}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'category',
      header: 'Categoria',
      accessor: (r) => r.category ?? 'unknown',
      render: (r) => <CategoryBadge category={r.category} />,
    },
    {
      key: 'message_count',
      header: 'Messaggi',
      className: 'text-right',
      accessor: (r) => r.message_count,
    },
    {
      key: 'last_msg_date',
      header: 'Ultima attività',
      accessor: (r) => r.last_msg_date ?? '',
      render: (r) => (
        <div className="text-xs text-muted-foreground">
          <div>{shortDate(r.last_msg_date)}</div>
          <div className="text-[10px] opacity-70">{relativeItalian(r.last_msg_date)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Stato',
      accessor: (r) => r.status,
      render: (r) => <Badge variant="slate">{r.status}</Badge>,
    },
  ]

  return (
    <SortableTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      initialSort={{ key: 'last_msg_date', dir: 'desc' }}
      emptyMessage="Nessuna conversazione con i filtri attuali."
    />
  )
}
