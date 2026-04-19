import 'server-only'
import nodemailer from 'nodemailer'
import type { Attachment } from 'nodemailer/lib/mailer'

const HOST = process.env.SMTP_HOST ?? 'out.postassl.it'
const PORT = Number(process.env.SMTP_PORT ?? 465)
const USER = process.env.SMTP_USER ?? 'gg@verganiegasco.it'
const PASS = process.env.SMTP_PASS ?? ''
const FROM = process.env.SMTP_FROM ?? `${process.env.SMTP_FROM_NAME ?? 'Giuseppe Giunta'} <${USER}>`

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  if (!PASS) throw new Error('SMTP_PASS non configurata nel compose environment')
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  })
  return transporter
}

export interface SendParams {
  to: string[]
  cc?: string[]
  subject: string
  text?: string
  html?: string
  attachments?: Attachment[]
  inReplyTo?: string
  references?: string
}

export async function sendMail(p: SendParams) {
  const t = getTransporter()
  const info = await t.sendMail({
    from: FROM,
    to: p.to.join(', '),
    cc: p.cc?.length ? p.cc.join(', ') : undefined,
    subject: p.subject,
    text: p.text,
    html: p.html,
    attachments: p.attachments,
    inReplyTo: p.inReplyTo,
    references: p.references,
  })
  return { messageId: info.messageId ?? null, accepted: info.accepted ?? [], rejected: info.rejected ?? [] }
}
