"""mail_extract v3 — più selettivo.

Un TODO è una frase che DEVE rispettare UNO di questi pattern:
  - Domanda esplicita ("...?")
  - Verbo imperativo italiano o inglese nelle prime 3 parole (invia, manda, conferma, firma, approva, please, send, confirm, provide, reply, review…)
  - Frase con deadline/scadenza chiara (entro, deadline, scadenza, by, due, within)
  - Frase con keyword business (fattura/invoice, preventivo/quote, bonifico/payment, offerta/offer, contratto/contract, firma/signature, riunione/meeting)

Lunghezza 30-220 char. Massimo 4 todo per mail.
Blacklist aggressiva contro noise (unsubscribe, firme, disclaimer, automated).

La funzione è retro-compatibile: `extract_todos_v2(...)` nome lasciato per compatibilità
degli altri script, ma la logica è v3.
"""
from __future__ import annotations
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime


BLACKLIST = re.compile(
    r'unsubscribe|no[- ]?reply|mailto:|disclaimer|view in browser|view online|copyright'
    r'|questa email|this email|confidential|do not reply|privacy policy|cookie policy'
    r'|update (?:your )?(?:email )?preferences|non rispondere|manage your|is confidential'
    r'|if you have received|sent to you|you are receiving|turbosquid|addthis|unsubscribing'
    r'|trasferimento inviati|visualizzato in anteprima|scarica il|scaricati|download link'
    r'|happy holidays|buone feste|segreteria|kind regards|best regards|distinti saluti'
    r'|^(?:from|da|subject|oggetto|sent|inviato|to|a|cc|date|data)\s*:'
    r'|^(?:hi|hello|ciao|salve|buongiorno|buonasera|dear|gentile|spett)\b'
    r'|verificare|puoi visualizzare',
    re.IGNORECASE,
)


# Verbi imperativi ammissibili (inizio frase di 3 parole)
IT_IMPERATIVES = {
    'invia', 'inviate', 'invii', 'invio', 'manda', 'mandate', 'conferma', 'confermi', 'confermate',
    'firma', 'firmi', 'firmate', 'approva', 'approvi', 'approvate', 'verifica', 'verifichi',
    'controlla', 'controllate', 'aggiorna', 'aggiornate', 'rispondi', 'rispondete',
    'preparate', 'prepara', 'procedi', 'procedete', 'fammi', 'ditemi', 'scrivi', 'scrivete',
    'fornisci', 'fornite', 'indica', 'indicate', 'segnala', 'segnalate', 'caricare',
    'devi', 'dovete', 'bisogna', 'serve', 'servirebbe', 'per favore', 'gentilmente',
    'fateci', 'fammi sapere', 'puoi', 'potresti', 'potreste', 'possiamo',
    'ci serve', 'mi serve', 'ho bisogno',
}
EN_IMPERATIVES = {
    'please', 'send', 'confirm', 'sign', 'approve', 'review', 'verify', 'update', 'reply',
    'provide', 'submit', 'check', 'schedule', 'book', 'advise', 'let us know', 'let me know',
    'could you', 'can you', 'would you', 'should we', 'we need', 'i need', 'kindly',
}

BUSINESS_KEYWORDS = re.compile(
    r'\b(?:fattura|invoice|preventivo|quote|offerta|offer|contratto|contract|bonifico'
    r'|payment|pagamento|firma|signature|riunione|meeting|call|appuntamento|appointment'
    r'|deadline|scadenza|entro|by (?:monday|tuesday|wednesday|thursday|friday|[0-9])'
    r'|within|due|proposta|proposal|campioni|sample|spedizione|shipping|delivery|consegna'
    r'|allegato|attach(?:ment|ed)|foto|photo|render|documenti|revisione|revision)\b',
    re.IGNORECASE,
)


QUOTED_LINE = re.compile(r'^\s*>')
SIGNATURE_SEP = re.compile(r'^\s*-- ?\s*$')
SIGNATURE_BLOCK = re.compile(r'\b(?:cordiali saluti|best regards|kind regards|saluti|cheers|thanks|grazie)\b', re.IGNORECASE)


def _normalize(body: str) -> str:
    if not body:
        return ''
    lines: list[str] = []
    sig_seen = False
    for raw in body.splitlines():
        if sig_seen:
            break
        if SIGNATURE_SEP.match(raw):
            break
        if QUOTED_LINE.match(raw):
            continue
        if re.match(r'^(?:From|Da|Sent|Inviato|To|A|Cc|Subject|Oggetto|Date|Data)\s*:', raw, re.IGNORECASE):
            continue
        if SIGNATURE_BLOCK.search(raw) and len(raw.strip()) < 40:
            sig_seen = True
            continue
        lines.append(raw.strip())
    text = '\n'.join(lines)
    text = re.sub(r'\n{2,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


def _split_sentences(text: str) -> list[str]:
    out: list[str] = []
    for chunk in re.split(r'\n{2,}', text):
        for s in re.split(r'(?<=[.!?])\s+(?=[A-ZÀ-Ú])', chunk):
            s = s.strip()
            if s:
                out.append(s)
    return out


def _starts_with_imperative(s: str) -> bool:
    head = ' '.join(s.split()[:3]).lower()
    if any(head.startswith(v) or (' ' + v + ' ') in ' ' + head + ' ' for v in IT_IMPERATIVES):
        return True
    if any(head.startswith(v) for v in EN_IMPERATIVES):
        return True
    return False


def _within_14_days(date_iso: str) -> bool:
    if not date_iso:
        return False
    try:
        d = datetime.fromisoformat(date_iso.replace('Z', '+00:00'))
    except Exception:
        try:
            d = parsedate_to_datetime(date_iso)
        except Exception:
            return False
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d >= (datetime.now(timezone.utc) - timedelta(days=14))


DATE_WORDS = re.compile(
    r'\bentro\s+(?:il\s+)?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|(?:lun|mar|mer|gio|ven|sab|dom)(?:edì|tedì|coledì|vedì|erdì|ato|enica)?)'
    r'|\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)',
    re.IGNORECASE,
)


def _guess_deadline(text: str) -> str | None:
    m = DATE_WORDS.search(text)
    if not m:
        return None
    return (m.group(1) or m.group(2) or '').strip() or None


def extract_todos_v2(*, body_text: str, subject: str, from_email: str, date_iso: str,
                    client_domain: str | None, is_client: bool) -> list[dict]:
    if not is_client or not client_domain:
        return []
    if not _within_14_days(date_iso):
        return []
    if not body_text:
        return []
    text = _normalize(body_text)
    candidates = _split_sentences(text)
    out: list[dict] = []
    seen: set[str] = set()
    for s in candidates:
        if len(s) < 30 or len(s) > 220:
            continue
        if BLACKLIST.search(s):
            continue
        has_q = '?' in s
        has_imp = _starts_with_imperative(s)
        has_biz = bool(BUSINESS_KEYWORDS.search(s))
        if not (has_q or has_imp or has_biz):
            continue
        # Score: question+biz=3, imperative+biz=3, imperative=2, biz=1, question=1
        score = 0
        if has_q: score += 1
        if has_imp: score += 2
        if has_biz: score += 2
        key = re.sub(r'\s+', ' ', s.lower())[:140]
        if key in seen:
            continue
        seen.add(key)
        out.append({'text': s, 'priority': min(5, score), 'deadline': _guess_deadline(s)})
    out.sort(key=lambda t: (-t['priority'], t['text']))
    return out[:4]
