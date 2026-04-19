#!/usr/bin/env python3
"""Migration 003: add body_text/body_html to mails; add is_inline to attachments.

Then backfills:
  - mails.body_text and body_html via IMAP UID fetch (capped to recent mails by default)
  - attachments.is_inline = 1 if attachment is a signature image (inline Content-Disposition
    OR mime image/* with size < 20KB OR filename matching image0\\d+\\.(png|jpg|jpeg|gif))
"""
import email as eml
import imaplib
import os
import re
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')
ENV = Path('/home/node/.config/imap-smtp-email/.env')
RECENT_DAYS = int(os.environ.get('BACKFILL_DAYS', '60'))
LIMIT = int(os.environ.get('BACKFILL_LIMIT', '400'))


def column_exists(conn, table: str, column: str) -> bool:
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})"))


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
    return '\n'.join(l for l in (''.join(p.buf)).splitlines() if l.strip()).strip()


INLINE_FILENAME_RE = re.compile(r'^(image|img|oledata|clip_image)[-_0-9]*\.(png|jpe?g|gif|bmp|webp)$', re.IGNORECASE)


def extract_bodies(raw: bytes):
    """Return (text, html, inline_cids set)."""
    msg = eml.message_from_bytes(raw)
    text_parts = []
    html_parts = []
    inline_cids: set[str] = set()

    for part in msg.walk():
        if part.is_multipart():
            continue
        disp = (part.get('Content-Disposition') or '').lower()
        ct = part.get_content_type()
        cid = (part.get('Content-ID') or '').strip('<>')
        if 'inline' in disp and ct.startswith('image/'):
            if cid:
                inline_cids.add(cid)

        if ct == 'text/plain':
            try:
                text_parts.append(part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='replace'))
            except Exception:
                pass
        elif ct == 'text/html':
            try:
                html_parts.append(part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='replace'))
            except Exception:
                pass

    body_text = '\n\n'.join(text_parts).strip()
    body_html = '\n'.join(html_parts).strip() if html_parts else ''
    if not body_text and body_html:
        body_text = html_to_text(body_html)
    return body_text, body_html, inline_cids


def main() -> int:
    if not DB.exists():
        print("ERR: db not found", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=DELETE')

    # 1. ALTER COLUMNS
    for col, typ in [('body_text', 'TEXT'), ('body_html', 'TEXT')]:
        if not column_exists(conn, 'mails', col):
            conn.execute(f'ALTER TABLE mails ADD COLUMN {col} {typ}')
            print(f'OK added mails.{col}')
    if not column_exists(conn, 'attachments', 'is_inline'):
        conn.execute('ALTER TABLE attachments ADD COLUMN is_inline INTEGER DEFAULT 0')
        print('OK added attachments.is_inline')
    conn.commit()

    # 2. FLAG inline attachments heuristically (no IMAP needed)
    q = """
      UPDATE attachments SET is_inline = 1
      WHERE is_inline = 0 AND (
          (mime LIKE 'image/%' AND size < 20480)
          OR (mime LIKE 'image/%' AND lower(filename) GLOB 'image[0-9]*.*')
          OR (mime LIKE 'image/%' AND lower(filename) GLOB 'img[-_0-9]*.*')
          OR (mime LIKE 'image/%' AND lower(filename) GLOB 'oledata*.*')
      )
    """
    r = conn.execute(q)
    print(f'flagged {r.rowcount} inline attachments')
    conn.commit()

    # 3. IMAP backfill bodies
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)).isoformat()
    rows = conn.execute(
        """
        SELECT m.uid FROM mails m
        WHERE m.body_text IS NULL AND m.date >= ?
        ORDER BY m.date DESC LIMIT ?
        """,
        (cutoff, LIMIT),
    ).fetchall()
    if not rows:
        print('no rows to backfill')
        conn.close()
        return 0

    env = load_env(ENV)
    M = imaplib.IMAP4_SSL(env['IMAP_HOST'], int(env.get('IMAP_PORT', 993)))
    M.login(env['IMAP_USER'], env['IMAP_PASS'])
    M.select('INBOX')

    done = 0
    cid_updates = 0
    for r in rows:
        uid = r['uid']
        try:
            status, data = M.uid('fetch', str(uid).encode(), '(RFC822)')
            if status != 'OK' or not data or data[0] is None:
                continue
            raw = data[0][1]
            body_text, body_html, inline_cids = extract_bodies(raw)
            conn.execute(
                'UPDATE mails SET body_text=?, body_html=? WHERE uid=?',
                (body_text[:400_000] if body_text else None, body_html[:800_000] if body_html else None, uid),
            )
            if inline_cids:
                r2 = conn.execute(
                    """
                    UPDATE attachments SET is_inline=1
                    WHERE mail_uid=? AND (path IS NOT NULL OR filename IS NOT NULL)
                      AND (
                        lower(filename) GLOB 'image[0-9]*.*'
                        OR mime LIKE 'image/%'
                      )
                    """,
                    (uid,),
                )
                cid_updates += r2.rowcount
            done += 1
            if done % 25 == 0:
                conn.commit()
                print(f'  backfilled {done}/{len(rows)}')
        except Exception as e:
            print(f'  err uid {uid}: {e}')

    conn.commit()
    conn.close()
    try:
        M.logout()
    except Exception:
        pass
    print(f'backfilled bodies: {done} / inline attachment updates: {cid_updates}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
