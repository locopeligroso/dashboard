import './globals.css'
import type { ReactNode } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export const metadata = {
  title: 'CRM Mail — verganiegasco',
  description: 'Dashboard operativa thread clienti, task, allegati, link',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TooltipProvider delayDuration={200}>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-x-hidden">
              <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 pt-16 md:pt-8">
                {children}
              </div>
            </main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  )
}
