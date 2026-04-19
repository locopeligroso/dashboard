'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ListTodo,
  MessagesSquare,
  Paperclip,
  Link2,
  Menu,
  FolderKanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

const ITEMS = [
  { href: '/', label: 'Riepilogo', icon: LayoutDashboard, match: /^\/dashboard\/?$/ },
  { href: '/clients', label: 'Clienti', icon: Users, match: /^\/dashboard\/clients/ },
  { href: '/projects', label: 'Progetti', icon: FolderKanban, match: /^\/dashboard\/projects/ },
  { href: '/tasks', label: 'Task', icon: ListTodo, match: /^\/dashboard\/tasks/ },
  { href: '/threads', label: 'Conversazioni', icon: MessagesSquare, match: /^\/dashboard\/threads/ },
  { href: '/attachments', label: 'Allegati', icon: Paperclip, match: /^\/dashboard\/attachments/ },
  { href: '/links', label: 'Link', icon: Link2, match: /^\/dashboard\/links/ },
]

function NavList({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = item.match.test(pathname)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  return (
    <>
      <div className="md:hidden fixed top-3 left-3 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Apri menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetTitle className="mb-4">CRM Mail</SheetTitle>
            <NavList pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>
      <aside className="hidden md:flex md:flex-col md:w-60 md:border-r md:border-border md:h-screen md:sticky md:top-0 md:p-4">
        <div className="mb-6 px-2">
          <div className="text-base font-semibold">CRM Mail</div>
          <div className="text-xs text-muted-foreground">verganiegasco.it</div>
        </div>
        <NavList pathname={pathname} />
      </aside>
    </>
  )
}
