#!/usr/bin/env python3
"""Napoleon-driven task extraction (quality over quantity).

For each client mail (category=client) recent and not yet processed:
  - Sends the mail body to Napoleon with a tight prompt that asks:
      - Is there an action Giuseppe (verganiegasco.it) must take? If yes, list them.
      - Associate to an existing project (by client_domain) or suggest a new name.
      - Return STRICT JSON: {tasks: [{text, project_name_suggested?, owner, deadline?}], none_if_noise}
  - If none_if_noise=true → mark mail as processed with 0 tasks.
  - Otherwise insert tasks in todos table with project_id matched or created.

Requirements: runs INSIDE openclaw container (has `openclaw agent` CLI).
"""
import json
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')
CUTOFF = '2026-03-01'
CLIENT_OWNER = 'giuseppe'  # per ora sempre giuseppe; se Napoleon dice altrimenti useremo


PROMPT_TEMPLATE = """Analizza la mail sotto e rispondi SOLO con un JSON valido (no preamboli, no markdown).

{{
  "tasks": [
    {{
      "text": "azione che Giuseppe (verganiegasco.it) deve fare, breve e concreta",
      "project_name_suggested": "nome progetto esistente o nuovo",
      "owner": "giuseppe" | "team" | "cliente",
      "deadline": "YYYY-MM-DD"?  # se esplicita nella mail
    }}
  ],
  "none_if_noise": false
}}

Regole STRINGENTI:
- Includi SOLO task che Giuseppe deve fare (mail verganiegasco.it)
- Se la mail è informativa (ricevuta, conferma registrazione, auto-reply, segreteria), `none_if_noise: true` e `tasks: []`
- Se la mail è una newsletter/promo, `none_if_noise: true` e `tasks: []`
- Un task breve, concreto, imperativo (max 140 char)
- project_name_suggested: guarda il thread/oggetto; se parla di "Sicis vetrite" suggerisci "Sicis - Vetrite", ecc.

Cliente: {client_domain}
Oggetto: {subject}
Data: {date}
Mittente: {from_email}

Corpo mail:
{body}
"""


def ask_napoleon(prompt: str, timeout: int = 120) -> str:
    p = Path(f'/tmp/napoleon_task_prompt.txt')
    p.write_text(prompt, encoding='utf-8')
    r = subprocess.run(
        ['bash', '-lc', f'MSG=$(cat {p}); openclaw agent --agent main --message "$MSG"'],
        capture_output=True, text=True, timeout=timeout,
    )
    return r.stdout.strip()


def parse_json_loose(s: str):
    # Find first '{' and last '}'
    i = s.find('{')
    j = s.rfind('}')
    if i < 0 or j <= i:
        return None
    block = s[i:j + 1]
    try:
        return json.loads(block)
    except Exception:
        # Strip ```json blocks / trailing commas
        block = re.sub(r',\s*([}\]])', r'\1', block)
        try:
            return json.loads(block)
        except Exception:
            return None


def ensure_napoleon_processed_column(conn):
    cols = [r[1] for r in conn.execute("PRAGMA table_info(mails)")]
    if 'napoleon_processed' not in cols:
        conn.execute("ALTER TABLE mails ADD COLUMN napoleon_processed INTEGER DEFAULT 0")
        conn.commit()
        print('added mails.napoleon_processed')


def find_or_create_project(conn, client_domain: str, suggested: str | None) -> int:
    name = (suggested or 'Generale').strip()
    row = conn.execute(
        'SELECT id FROM projects WHERE client_domain=? AND lower(name)=lower(?)',
        (client_domain, name),
    ).fetchone()
    if row:
        return row[0]
    cur = conn.execute(
        "INSERT INTO projects(client_domain, name, status) VALUES (?, ?, 'active')",
        (client_domain, name),
    )
    return cur.lastrowid


def main(limit: int = 50) -> int:
    if not DB.exists():
        print('db missing', file=sys.stderr)
        return 1
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=DELETE')
    ensure_napoleon_processed_column(conn)

    rows = conn.execute(
        """
        SELECT m.uid, m.subject, m.from_email, m.date, m.body_text,
               t.company_domain AS client_domain, t.id AS thread_id
        FROM mails m
        JOIN threads t ON t.id = m.thread_id
        JOIN company_categories cc ON cc.domain = t.company_domain
        WHERE cc.category = 'client'
          AND m.date >= ?
          AND m.is_spam = 0
          AND (m.napoleon_processed IS NULL OR m.napoleon_processed = 0)
          AND m.body_text IS NOT NULL AND length(m.body_text) > 40
        ORDER BY m.date DESC
        LIMIT ?
        """,
        (CUTOFF, limit),
    ).fetchall()

    if not rows:
        print('no pending mails')
        conn.close()
        return 0

    processed = 0
    tasks_inserted = 0
    for r in rows:
        body = (r['body_text'] or '').strip()[:6000]
        prompt = PROMPT_TEMPLATE.format(
            client_domain=r['client_domain'],
            subject=r['subject'] or '(senza oggetto)',
            date=r['date'],
            from_email=r['from_email'] or '',
            body=body,
        )
        try:
            out = ask_napoleon(prompt, timeout=120)
        except subprocess.TimeoutExpired:
            print(f'TIMEOUT uid={r["uid"]}')
            continue

        parsed = parse_json_loose(out)
        if parsed is None:
            print(f'ERR parse uid={r["uid"]}: {out[:100]!r}')
            continue

        noise = bool(parsed.get('none_if_noise', False))
        tasks = parsed.get('tasks', []) or []

        if noise or not tasks:
            conn.execute('UPDATE mails SET napoleon_processed=1 WHERE uid=?', (r['uid'],))
            conn.commit()
            processed += 1
            print(f'  uid={r["uid"]}: noise (no tasks)')
            continue

        for t in tasks:
            text = (t.get('text') or '').strip()[:220]
            if len(text) < 10:
                continue
            owner = (t.get('owner') or 'giuseppe').lower()
            if owner not in ('giuseppe', 'team', 'cliente', 'shared'):
                owner = 'giuseppe'
            deadline = t.get('deadline')
            proj_id = find_or_create_project(conn, r['client_domain'], t.get('project_name_suggested'))
            # assign thread to project if not already
            conn.execute('UPDATE threads SET project_id=COALESCE(project_id, ?) WHERE id=?', (proj_id, r['thread_id']))
            conn.execute(
                """
                INSERT INTO todos(mail_uid, text, deadline, done, source, owner, client_domain)
                VALUES (?, ?, ?, 0, 'napoleon', ?, ?)
                """,
                (r['uid'], text, deadline, owner, r['client_domain']),
            )
            tasks_inserted += 1

        conn.execute('UPDATE mails SET napoleon_processed=1 WHERE uid=?', (r['uid'],))
        conn.commit()
        processed += 1
        print(f'  uid={r["uid"]}: {len(tasks)} tasks')

    print(f'done. mails processed: {processed}, tasks inserted: {tasks_inserted}')
    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main(limit=int(sys.argv[1]) if len(sys.argv) > 1 else 30))
