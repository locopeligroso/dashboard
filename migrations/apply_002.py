#!/usr/bin/env python3
"""Migration 002: projects + chat_threads + chat_messages + threads.project_id column.

Also seeds one default project per categorized client and binds all threads to it.
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
        print(f"ERR: db not found", file=sys.stderr)
        return 1
    conn = sqlite3.connect(str(DB))
    try:
        conn.executescript((SQL_DIR / '002_projects_chat.sql').read_text())
        print("OK 002 applied")

        if not column_exists(conn, 'threads', 'project_id'):
            conn.execute("ALTER TABLE threads ADD COLUMN project_id INTEGER")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_project ON threads(project_id)")
            print("OK added threads.project_id")
        else:
            print("skip threads.project_id (exists)")

        # Seed: one default project per client
        clients = conn.execute(
            """
            SELECT cc.domain
            FROM company_categories cc
            WHERE cc.category='client'
            """,
        ).fetchall()

        created = 0
        assigned = 0
        for (domain,) in clients:
            existing = conn.execute(
                "SELECT id FROM projects WHERE client_domain=? LIMIT 1",
                (domain,),
            ).fetchone()
            if existing:
                proj_id = existing[0]
            else:
                cur = conn.execute(
                    "INSERT INTO projects(client_domain, name, status) VALUES (?, 'Generale', 'active')",
                    (domain,),
                )
                proj_id = cur.lastrowid
                created += 1
            res = conn.execute(
                "UPDATE threads SET project_id=? WHERE company_domain=? AND project_id IS NULL",
                (proj_id, domain),
            )
            assigned += res.rowcount
        conn.commit()
        print(f"projects created: {created} / threads assigned: {assigned}")
    finally:
        conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
