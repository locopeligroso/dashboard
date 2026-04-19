"""mail_extract — reusable extraction primitives for CRM pipeline.

This module is imported by mail-index.py and reindex_todos_clients.py.
stdlib only.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime


BLACKLIST = re.compile(
    r'unsubscribe|no[- ]?reply|mailto:|disclaimer|view in browser|view online|copyright'
    r'|questa email|this email|confidential|do not reply|privacy policy'
    r'|update (?:your )?(?:email )?preferences|non rispondere|^re:|^fwd?:'
    r'|manage your (?:email )?preferences|is confidential|if you have received'
    r'|sent to you|you are receiving|turbosquid|addthis|unsubscribing|trasferimento inviati'
    r'|visualizzato in anteprima|anteprima il tuo trasferimento',
    re.IGNORECASE,
)


PRIORITY_KEYWORDS = re.compile(
    r'\b(?:entro|deadline|scadenza|urgent(?:e)?|asap|per favore|please|confermare|confirm'
    r'|approva|approve|fattura|invoice|invia|send|firma|sign|pagamento|payment|bonifico'
    r'|offerta|preventivo|quote|contract|contratto|riunione|meeting|call|chiamata'
    r'|revisione|feedback|verifica|check|controlla|aggiorna|update|risposta|reply)\b',
    re.IGNORECASE,
)


QUOTED_LINE = re.compile(r'^\s*>')
SIGNATURE_SEP = re.compile(r'^-- ?$')


def _normalize_body(body: str) -> str:
    """Strip quoted reply chains, signature, normalize whitespace."""
    if not body:
        return ''
    lines = []
    for raw in body.splitlines():
        if SIGNATURE_SEP.match(raw):
            break
        if QUOTED_LINE.match(raw):
            continue
        # drop header markers from forwarded/reply blocks
        if re.match(r'^(From|Da|Sent|Inviato|To|A|Cc|Subject|Oggetto|Date|Data)\s*:', raw, re.IGNORECASE):
            continue
        lines.append(raw.strip())
    text = '\n'.join(lines)
    text = re.sub(r'\n{2,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


def _split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for chunk in re.split(r'\n{2,}', text):
        for s in re.split(r'(?<=[.!?])\s+(?=[A-ZÀ-Ú])', chunk):
            s = s.strip()
            if s:
                parts.append(s)
    return parts


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


def extract_todos_v2(
    *,
    body_text: str,
    subject: str,
    from_email: str,
    date_iso: str,
    client_domain: str | None,
    is_client: bool,
) -> list[dict]:
    """Return a list of todo dicts from a single mail.

    Each dict: {text, priority (int 0..5), deadline (str|None)}.

    The function enforces client-only and 14-day windows strictly: returns [] otherwise.
    """
    if not is_client or not client_domain:
        return []
    if not _within_14_days(date_iso):
        return []
    if not body_text:
        return []

    text = _normalize_body(body_text)
    candidates = _split_sentences(text)
    todos: list[dict] = []
    seen: set[str] = set()

    for s in candidates:
        if len(s) < 15 or len(s) > 250:
            continue
        if BLACKLIST.search(s):
            continue
        key = re.sub(r'\s+', ' ', s.lower())[:120]
        if key in seen:
            continue
        seen.add(key)
        hits = len(PRIORITY_KEYWORDS.findall(s))
        if hits == 0 and len(todos) >= 5:
            # keep up to 5 low-priority plus all with keywords
            continue
        todos.append({'text': s, 'priority': min(5, hits), 'deadline': _guess_deadline(s)})

    # sort by priority desc
    todos.sort(key=lambda t: (-t['priority'], t['text']))
    # cap at 8 per mail
    return todos[:8]


DATE_WORDS_IT = re.compile(
    r'\bentro\s+(?:il\s+)?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica))',
    re.IGNORECASE,
)


def _guess_deadline(text: str) -> str | None:
    m = DATE_WORDS_IT.search(text)
    return m.group(1) if m else None
