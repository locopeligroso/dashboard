import 'server-only'

/**
 * Pulisce il corpo della mail rimuovendo:
 * - Quoted text ("On ... wrote:", "Il giorno ...", "Da:/From:/Sent:/Subject:" multi-line header)
 * - Linee citate ">" in blocchi
 * - Firme standard dopo "-- " o pattern "Sent from my iPhone" / "Get Outlook"
 * - Disclaimer aziendali lunghi in fondo
 * - Righe vuote consecutive
 */

const REPLY_HEADER = /^(On\s.+\swrote:|Il\s.+\s(?:ha\s)?scritto:|Le\s.+\sà\s?écrit:|El\s.+\sescribió:|Am\s.+\sschrieb:)$/i
const FORWARD_HEADER = /^(From|Da|Sent|Inviato|To|A|Cc|Bcc|Ccn|Subject|Oggetto|Date|Data|Reply-To)\s*:/i
const BEGIN_FORWARDED = /^-+\s*(Forwarded message|Messaggio inoltrato|Original Message|Messaggio originale)\s*-+/i
const SIGNATURE_SEP = /^-- ?$/
const AUTO_SIGNATURE = /^(Sent from my (iPhone|iPad|Android|BlackBerry)|Get Outlook for|Inviato dal mio|Envoy[ée] depuis mon)/i
const DISCLAIMER_MARKERS = [
  /this (?:e-?mail|message) (?:and any attachments )?(?:is )?confidential/i,
  /questa email (?:e i relativi allegati )?(?:è|e'|sono) (?:riservata|confidenziale)/i,
  /if you (?:are not the intended recipient|have received)/i,
  /non è l'indirizzo al quale/i,
  /informativa privacy/i,
  /ai sensi degli artt/i,
  /gdpr|regolamento ue 2016\/679/i,
  /informazioni confidenziali/i,
]

export function cleanMailText(raw: string): string {
  if (!raw) return ''
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let quotedBlockRun = 0
  let consecutiveHeaders = 0
  let stop = false

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const t = l.trim()

    if (stop) break

    if (SIGNATURE_SEP.test(t)) { stop = true; break }
    if (AUTO_SIGNATURE.test(t)) { stop = true; break }
    if (BEGIN_FORWARDED.test(t)) { stop = true; break }
    if (REPLY_HEADER.test(t)) { stop = true; break }

    if (/^\s*>/.test(l)) {
      quotedBlockRun++
      if (quotedBlockRun >= 2) { stop = true; break }
      continue
    } else {
      quotedBlockRun = 0
    }

    // Detect sequence of forward-style header lines (From:, Sent:, ...)
    if (FORWARD_HEADER.test(t)) {
      consecutiveHeaders++
      if (consecutiveHeaders >= 2) { stop = true; break }
      continue
    } else {
      consecutiveHeaders = 0
    }

    // Disclaimer: stop on match
    if (DISCLAIMER_MARKERS.some((re) => re.test(t))) { stop = true; break }

    out.push(l)
  }

  // Trim trailing empty lines
  while (out.length && !out[out.length - 1].trim()) out.pop()

  // Collapse >2 empty lines into 1
  const collapsed: string[] = []
  let blank = 0
  for (const l of out) {
    if (!l.trim()) {
      blank++
      if (blank > 1) continue
      collapsed.push('')
    } else {
      blank = 0
      collapsed.push(l)
    }
  }
  return collapsed.join('\n').trim()
}

/**
 * HTML cleaning: rimuove blockquote (quoted), div.gmail_quote, signature,
 * disclaimer textblocks. Conserva il resto. Best-effort lightweight (no DOM lib).
 */
export function cleanMailHtml(raw: string): string {
  if (!raw) return ''
  let s = raw
  // Remove obvious thread blocks (Gmail/Outlook)
  s = s.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
  s = s.replace(/<div class="gmail_quote"[\s\S]*?<\/div>/gi, '')
  s = s.replace(/<div class="gmail_extra"[\s\S]*?<\/div>/gi, '')
  s = s.replace(/<div id="?(divRplyFwdMsg|appendonsend|m_\d+)[^>]*>[\s\S]*?<\/div>/gi, '')
  // Outlook "From:" blocks in <hr><b>
  s = s.replace(
    /<hr[^>]*>\s*<[^>]*>\s*(<b[^>]*>)?\s*(From|Da|Sent|Inviato):[\s\S]*/i,
    '',
  )
  // Strip long trailing disclaimer <p>s
  s = s.replace(
    /<p[^>]*>[\s\S]*?(this e-?mail (?:and any attachments )?(?:is )?confidential|questa (?:email|e-?mail|comunicazione) (?:è|e') (?:riservata|confidenziale))[\s\S]*?<\/p>[\s\S]*/gi,
    '',
  )
  // Remove auto-reply signature blocks
  s = s.replace(
    /<(div|p)[^>]*>\s*(Sent from my (iPhone|iPad|Android)|Get Outlook for|Inviato dal mio)[^<]*<\/(div|p)>/gi,
    '',
  )
  return s.trim()
}
