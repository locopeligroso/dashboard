#!/usr/bin/env python3
"""Idempotent migration runner for CRM dashboard v2.

Applies:
  - PRAGMA journal_mode=DELETE (disable WAL so we can dual-mount read-only + read-write)
  - 001_schema.sql (tables, indexes)
  - ALTER TABLE todos ADD COLUMN owner (if missing)
"""
import sqlite3
import sys
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')
SQL_DIR = Path(__file__).parent


def column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == column for r in rows)


def main() -> int:
    if not DB.exists():
        print(f"ERR: db not found at {DB}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(DB))
    conn.executescript("PRAGMA journal_mode=DELETE;")
    try:
        conn.executescript((SQL_DIR / '001_schema.sql').read_text())
        print("OK 001_schema.sql applied")

        if not column_exists(conn, 'todos', 'owner'):
            conn.execute("ALTER TABLE todos ADD COLUMN owner TEXT DEFAULT 'giuseppe'")
            print("OK added todos.owner")
        else:
            print("skip todos.owner (exists)")

        if not column_exists(conn, 'todos', 'client_domain'):
            conn.execute("ALTER TABLE todos ADD COLUMN client_domain TEXT")
            print("OK added todos.client_domain")
        else:
            print("skip todos.client_domain (exists)")

        conn.commit()
    finally:
        conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
