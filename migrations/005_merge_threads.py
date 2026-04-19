#!/usr/bin/env python3
"""Merge duplicate threads that share (company_domain, normalized subject).

The mail indexer produced multiple thread rows for the same conversation because
the thread_id was not normalized well. This script consolidates them:
  - Group by (lower(company_domain), normalized subject_root)
  - Keep the oldest-id thread as canonical
  - UPDATE mails.thread_id to point all to canonical
  - DELETE duplicate threads
  - Recompute message_count / first_msg_date / last_msg_date on canonical
"""
import re
import sqlite3
import sys
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')


def normalize_subject(s: str) -> str:
    if not s:
        return ''
    s = s.lower()
    # Strip leading "subj:<domain>:" prefix produced by the legacy indexer
    s = re.sub(r'^subj:[^:]+:', '', s)
    # Strip re:/fw:/fwd: chains (potentially repeated)
    for _ in range(5):
        s = re.sub(r'^\s*(re|fw|fwd|r)\s*:\s*', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def main() -> int:
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=DELETE')

    rows = conn.execute(
        'SELECT id, company_domain, subject_root, first_msg_date FROM threads ORDER BY first_msg_date ASC, id ASC',
    ).fetchall()

    groups: dict[tuple, list[str]] = {}
    for r in rows:
        key = ((r['company_domain'] or '').lower(), normalize_subject(r['subject_root'] or ''))
        if not key[0] or not key[1]:
            continue
        groups.setdefault(key, []).append(r['id'])

    merged = 0
    threads_removed = 0
    for key, tids in groups.items():
        if len(tids) < 2:
            continue
        canonical = tids[0]
        dupes = tids[1:]
        for dupe in dupes:
            conn.execute('UPDATE mails SET thread_id=? WHERE thread_id=?', (canonical, dupe))
        conn.execute(
            f'DELETE FROM threads WHERE id IN ({",".join(["?"] * len(dupes))})',
            dupes,
        )
        # Recompute metadata on canonical
        meta = conn.execute(
            """
            SELECT count(*) AS n, min(date) AS first_date, max(date) AS last_date
            FROM mails WHERE thread_id = ?
            """,
            (canonical,),
        ).fetchone()
        if meta:
            conn.execute(
                'UPDATE threads SET message_count=?, first_msg_date=?, last_msg_date=? WHERE id=?',
                (meta['n'] or 0, meta['first_date'], meta['last_date'], canonical),
            )
        merged += 1
        threads_removed += len(dupes)
        print(f'  merged {len(dupes)} -> {canonical} | {key[0]} | {key[1][:60]}')

    conn.commit()
    tot = conn.execute('SELECT count(*) FROM threads').fetchone()[0]
    conn.close()
    print(f'done. groups merged: {merged}, threads removed: {threads_removed}, total threads now: {tot}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
