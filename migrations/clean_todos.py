#!/usr/bin/env python3
"""Purge garbage todos from the DB.

Rules (OR logic — if any matches, delete):
  - length(text) < 15 or > 250
  - text matches blacklist regex (newsletter footer, disclaimer, unsubscribe, etc)

After purge, print the count of deleted vs. remaining rows.
"""
import re
import sqlite3
import sys
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')

BLACKLIST = re.compile(
    r'unsubscribe|no[- ]?reply|mailto:|disclaimer|view in browser|view online|copyright'
    r'|questa email|this email|confidential|do not reply|privacy policy'
    r'|update (?:your )?(?:email )?preferences|non rispondere|^re:|^fwd?:'
    r'|manage your|is confidential|if you have received|sent to you'
    r'|you are receiving|turbosquid|addthis|istoppable|@\w+\.\w+ \.',
    re.IGNORECASE,
)


def main() -> int:
    if not DB.exists():
        print(f"ERR: db not found at {DB}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row

    before = conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
    rows = conn.execute("SELECT id, text FROM todos").fetchall()
    to_delete = []
    for r in rows:
        t = (r['text'] or '').strip()
        if len(t) < 15 or len(t) > 250 or BLACKLIST.search(t):
            to_delete.append(r['id'])

    if to_delete:
        conn.executemany("DELETE FROM todos WHERE id=?", [(i,) for i in to_delete])
        conn.commit()

    after = conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
    print(f"deleted={len(to_delete)} before={before} after={after}")
    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
