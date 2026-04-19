'use client'
import * as React from 'react'
import { FileIcon, Download, Image as ImageIcon, FileText, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Attachment } from '@/lib/types'
import { formatBytes } from '@/lib/utils'

function isImage(mime: string | null | undefined) {
  return !!mime && mime.startsWith('image/')
}
function isPdf(mime: string | null | undefined) {
  return mime === 'application/pdf'
}

export function AttachmentPreview({ att }: { att: Attachment }) {
  const inlineUrl = `/dashboard/api/attachments/${att.id}/download?inline=1`
  const dlUrl = `/dashboard/api/attachments/${att.id}/download`
  const [showPreview, setShowPreview] = React.useState(false)

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card/30 hover:bg-card/50 transition-colors">
      <div className="flex-shrink-0 w-14 h-14 rounded-md bg-muted overflow-hidden flex items-center justify-center">
        {isImage(att.mime) ? (
          <img src={inlineUrl} alt={att.filename} className="w-full h-full object-cover" loading="lazy" />
        ) : isPdf(att.mime) ? (
          <FileText className="h-7 w-7 text-rose-300" />
        ) : (
          <FileIcon className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm">{att.filename}</div>
        <div className="text-xs text-muted-foreground">
          {att.mime} · {formatBytes(att.size)}
        </div>
        {att.mail_subject ? (
          <div className="text-xs text-muted-foreground truncate mt-1">{att.mail_subject}</div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        {(isImage(att.mime) || isPdf(att.mime)) && (
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Anteprima">
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle className="truncate">{att.filename}</DialogTitle>
              </DialogHeader>
              {isImage(att.mime) ? (
                <img src={inlineUrl} alt={att.filename} className="w-full max-h-[70vh] object-contain" />
              ) : (
                <iframe src={inlineUrl} className="w-full h-[70vh]" title={att.filename} />
              )}
            </DialogContent>
          </Dialog>
        )}
        <a href={dlUrl} download={att.filename}>
          <Button size="icon" variant="outline" aria-label="Scarica">
            <Download className="h-4 w-4" />
          </Button>
        </a>
      </div>
    </div>
  )
}
