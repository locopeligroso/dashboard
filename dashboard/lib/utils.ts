import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function relativeItalian(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  const sec = Math.round(abs / 1000)
  const min = Math.round(sec / 60)
  const hour = Math.round(min / 60)
  const day = Math.round(hour / 24)
  const week = Math.round(day / 7)
  const future = diff < 0
  const fmt = (n: number, u: string) => (future ? `tra ${n} ${u}` : `${n} ${u} fa`)
  if (sec < 60) return 'ora'
  if (min < 60) return fmt(min, min === 1 ? 'minuto' : 'minuti')
  if (hour < 24) return fmt(hour, hour === 1 ? 'ora' : 'ore')
  if (day === 0) return 'oggi'
  if (day === 1) return future ? 'domani' : 'ieri'
  if (day < 7) return fmt(day, 'giorni')
  if (week < 5) return fmt(week, week === 1 ? 'settimana' : 'settimane')
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}
