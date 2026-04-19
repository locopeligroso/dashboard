#!/usr/bin/env python3
"""Re-extract todos from the last 14 days of client-only mails.

This:
  1. DELETEs all existing todos.
  2. SELECTs mails whose thread.company_domain has category='client' in company_categories
     AND mails.date >= 14 days ago.
  3. Fetches body from IMAP (via mail-index.py helpers if available, else raw RFC822 UID).
  4. Applies extract_todos_v2 (see mail_extract.py).
  5. INSERTs todos with client_domain and owner='giuseppe'.

Meant to be invoked after applying migration 001 and classify_companies.
"""
import imaplib
import email as eml
import os
import re
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')
ENV = Path('/home/node/.config/imap-smtp-email/.env')
WORKSPACE = Path('/home/node/.openclaw/workspace')
# import extractor
sys.path.insert(0, str(WORKSPACE))
try:
    from mail_extract import extract_todos_v2  # type: ignore
except Exception as e:  # pragma: no cover
    print(f"ERR: cannot import mail_extract: {e}", file=sys.stderr)
    sys.exit(2)


def load_env(p: Path) -> dict:
    env = {}
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


class _HTMLStrip(HTMLParser):
    def __init__(self):
        super().__init__()
        self.buf = []

    def handle_data(self, data):
        self.buf.append(data)


def html_to_text(html: str) -> str:
    p = _HTMLStrip()
    try:
        p.feed(html)
    except Exception:
        return html
    return ' '.join(''.join(p.buf).split())


def get_body_text(msg) -> str:
    plain = []
    html_fallback = []
    for part in msg.walk():
        if part.is_multipart():
            continue
        ct = part.get_content_type()
        if ct == 'text/plain':
            try:
                plain.append(part.get_payload(decode=True).decode(
                    part.get_content_charset() or 'utf-8', errors='replace'
                ))
            except Exception:
                pass
        elif ct == 'text/html':
            try:
                html_fallback.append(part.get_payload(decode=True).decode(
                    part.get_content_charset() or 'utf-8', errors='replace'
                ))
            except Exception:
                pass
    if plain:
        return '\n'.join(plain)
    if html_fallback:
        return html_to_text('\n'.join(html_fallback))
    return ''


def main() -> int:
    env = load_env(ENV)
    imap_host = env['IMAP_HOST']
    imap_port = int(env.get('IMAP_PORT', 993))
    imap_user = env['IMAP_USER']
    imap_pass = env['IMAP_PASS']

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=DELETE')

    # Purge existing todos — they will be rebuilt
    conn.execute('DELETE FROM todos')
    conn.commit()

    # Find eligible client mails: last 14 days, thread → domain → category='client'
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    rows = conn.execute(
        """
        SELECT m.uid, m.subject, m.from_email, m.date, t.company_domain AS domain
        FROM mails m
        JOIN threads t ON t.id = m.thread_id
        JOIN company_categories cc ON cc.domain = t.company_domain
        WHERE cc.category = 'client'
          AND m.is_spam = 0
          AND m.date >= ?
        ORDER BY m.date DESC
        """,
        (cutoff,),
    ).fetchall()

    if not rows:
        print("no eligible client mails in last 14 days")
        conn.close()
        return 0

    print(f"processing {len(rows)} client mails from last 14 days...")

    M = imaplib.IMAP4_SSL(imap_host, imap_port)
    M.login(imap_user, imap_pass)
    M.select('INBOX')

    inserted = 0
    for i, r in enumerate(rows, 1):
        try:
            status, data = M.uid('fetch', str(r['uid']).encode(), '(RFC822)')
            if status != 'OK' or not data or data[0] is None:
                continue
            raw = data[0][1]
            msg = eml.message_from_bytes(raw)
            body = get_body_text(msg)
            todos = extract_todos_v2(
                body_text=body,
                subject=r['subject'] or '',
                from_email=r['from_email'] or '',
                date_iso=r['date'] or '',
                client_domain=r['domain'],
                is_client=True,
            )
            for t in todos:
                conn.execute(
                    """
                    INSERT INTO todos(mail_uid, text, deadline, done, source, owner, client_domain)
                    VALUES (?, ?, ?, 0, 'body_v2', 'giuseppe', ?)
                    """,
                    (r['uid'], t['text'], t.get('deadline'), r['domain']),
                )
                inserted += 1
            if i % 20 == 0:
                conn.commit()
                print(f"  processed {i}/{len(rows)} — todos so far: {inserted}")
        except Exception as e:
            print(f"  err on uid {r['uid']}: {e}")

    conn.commit()
    conn.close()
    try:
        M.logout()
    except Exception:
        pass

    print(f"done. inserted {inserted} todos from client mails.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
