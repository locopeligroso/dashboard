#!/usr/bin/env python3
"""CRM mail scheduler — runs every 5 minutes.

- Executes: python3 mail-index.py 1 --incremental --stats
- Re-extracts todos for last 14 days from client mails (delta only).
- Inserts a row in `runs` table with delta counters.
- Writes its own PID to scheduler.pid for UI visibility.
"""
import os
import signal
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path('/home/node/.openclaw/workspace')
DB = WORKSPACE / 'mail-db.sqlite'
LOG = WORKSPACE / 'scheduler.log'
PID_FILE = WORKSPACE / 'scheduler.pid'
INTERVAL_SEC = 300  # 5 minutes


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).isoformat(timespec='seconds')
    with open(LOG, 'a') as f:
        f.write(f"[{ts}] {msg}\n")


def write_pid() -> None:
    PID_FILE.write_text(str(os.getpid()))


def cleanup_pid(*_: object) -> None:
    try:
        if PID_FILE.exists():
            PID_FILE.unlink()
    finally:
        sys.exit(0)


def counts() -> dict:
    con = sqlite3.connect(str(DB))
    row = lambda q: con.execute(q).fetchone()[0]
    out = {
        'mails': row('SELECT COUNT(*) FROM mails'),
        'threads': row('SELECT COUNT(*) FROM threads'),
        'todos': row('SELECT COUNT(*) FROM todos WHERE done=0'),
        'attachments': row('SELECT COUNT(*) FROM attachments'),
        'links': row('SELECT COUNT(*) FROM links'),
    }
    con.close()
    return out


def run_cycle() -> None:
    before = counts()
    try:
        subprocess.run(
            [
                'python3',
                str(WORKSPACE / 'mail-index.py'),
                '1',
                '--incremental',
                '--stats',
            ],
            stdout=open(LOG, 'a'),
            stderr=subprocess.STDOUT,
            check=False,
            timeout=240,
        )
    except subprocess.TimeoutExpired:
        log('mail-index timeout')
    # Apply extract_todos_v2 on the new mails within 14 days from clients
    try:
        subprocess.run(
            ['python3', str(WORKSPACE / 'migrations' / 'reindex_todos_clients.py')],
            stdout=open(LOG, 'a'),
            stderr=subprocess.STDOUT,
            check=False,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        log('reindex_todos timeout')

    after = counts()
    deltas = {k: after[k] - before[k] for k in after}

    con = sqlite3.connect(str(DB))
    con.execute('PRAGMA journal_mode=DELETE')
    con.execute(
        """
        INSERT INTO runs(ran_at, mails_added, todos_added, attachments_added, links_added)
        VALUES (datetime('now'), ?, ?, ?, ?)
        """,
        (
            deltas['mails'],
            deltas['todos'],
            deltas['attachments'],
            deltas['links'],
        ),
    )
    con.commit()
    con.close()
    log(f"cycle done deltas={deltas} totals={after}")


def main() -> int:
    if PID_FILE.exists():
        try:
            existing = int(PID_FILE.read_text().strip())
            os.kill(existing, 0)
            print(f"scheduler already running pid={existing}", file=sys.stderr)
            return 0
        except (ProcessLookupError, ValueError):
            PID_FILE.unlink()
    write_pid()
    signal.signal(signal.SIGTERM, cleanup_pid)
    signal.signal(signal.SIGINT, cleanup_pid)
    log('scheduler started interval=300s')
    while True:
        try:
            run_cycle()
        except Exception as e:
            log(f"cycle error: {e!r}")
        time.sleep(INTERVAL_SEC)


if __name__ == '__main__':
    sys.exit(main())
