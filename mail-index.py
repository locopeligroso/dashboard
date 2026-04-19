#!/usr/bin/env python3
import argparse
import email
import imaplib
import os
import re
import sqlite3
from email import policy
from email.header import decode_header
from email.utils import getaddresses
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

DB = '/home/node/.openclaw/workspace/mail-db.sqlite'
ATT_DIR = '/home/node/.openclaw/workspace/mail-attachments'
ENV_PATHS = ['/home/node/.config/imap-smtp-email/.env', '/home/node/.openclaw/workspace/skills/imap-smtp-email/.env']

URL_RE = re.compile(r'https?://[^\s\)<>]+', re.I)
SUBJECT_RE = re.compile(r'^(?:\s*(?:re|fwd|fw|r|i)\s*:\s*)+', re.I)
TODO_MARKERS = [
    r'da fare:', r'to do:', r'ricordati di', r'favore di', r'entro il\b',
    r'scadenza', r'action required', r'please\s+\w+', r'per favore\s+\w+'
]
TODO_RE = re.compile(r'(?i)(?:' + '|'.join(TODO_MARKERS) + r')')


def normalize_thread(subject: str) -> str:
    s = subject or ''
    s = s.strip()
    while True:
        ns = SUBJECT_RE.sub('', s)
        if ns == s:
            break
        s = ns.strip()
    return s.lower()


def extract_todos(text: str, source='body', subject=''):
    text = text or ''
    if 'spam' in (subject or '').lower():
        return []
    out = []
    for m in TODO_RE.finditer(text):
        start = max(0, m.start() - 100)
        end = min(len(text), m.end() + 100)
        out.append({'text': text[start:end].strip(), 'source': source})
    return out


def extract_links(text: str):
    return list(dict.fromkeys(URL_RE.findall(text or '')))


def get_domain(email: str):
    if not email or '@' not in email:
        return ''
    return email.rsplit('@', 1)[1].lower()


def get_thread_id(msg):
    irt = (msg.get('in_reply_to') or '').strip()
    refs = (msg.get('references') or '').strip()
    if irt:
        return f"msg:{irt}"
    if refs:
        return f"refs:{refs.split()[-1]}"
    subj = normalize_thread(msg.get('subject') or '')
    dom = get_domain(msg.get('from_email') or '')
    return f"subj:{dom}:{subj}"


def load_env():
    env = dict(os.environ)
    for p in ENV_PATHS:
        if os.path.exists(p):
            with open(p) as f:
                for line in f:
                    line=line.strip()
                    if '=' in line and not line.startswith('#'):
                        k,v=line.split('=',1)
                        env.setdefault(k.strip(), v.strip())
            break
    return env


def sanitize_filename(name):
    name = name or 'attachment'
    return re.sub(r'[\\/\s]+', '_', name)


def html_to_text(html):
    class P(HTMLParser):
        def __init__(self):
            super().__init__(); self.parts=[]
        def handle_data(self, d): self.parts.append(d)
    p=P(); p.feed(html or '')
    return '\n'.join(p.parts)


def decode_str(v):
    if not v: return ''
    out=''
    for part, enc in decode_header(v):
        if isinstance(part, bytes): out += part.decode(enc or 'utf-8', 'ignore')
        else: out += part
    return out


def fetch_imap_message(uid):
    env = load_env()
    host=env.get('IMAP_HOST')
    user=env.get('IMAP_USER')
    passwd=env.get('IMAP_PASS')
    port=int(env.get('IMAP_PORT','993'))
    tls=env.get('IMAP_TLS','true').lower()=='true'
    if not host or not user or not passwd:
        return None
    M = imaplib.IMAP4_SSL(host, port) if tls else imaplib.IMAP4(host, port)
    M.login(user, passwd)
    M.select(os.getenv('IMAP_MAILBOX','INBOX'))
    return M


def imap_date_for_months(months):
    return '19-Oct-2025'


def process_body_content(M, uid, cursor):
    typ, data = M.uid('fetch', str(uid).encode(), '(RFC822)')
    if typ != 'OK' or not data or not data[0]:
        return '', []
    raw = data[0][1]
    msg = email.message_from_bytes(raw, policy=policy.default)
    body_parts=[]
    attachments=[]
    for part in msg.walk():
        cdisp = (part.get_content_disposition() or '').lower()
        ctype = part.get_content_type()
        filename = part.get_filename()
        if ctype in ('text/plain','text/html') and cdisp != 'attachment':
            payload = part.get_content()
            body_parts.append(html_to_text(payload) if ctype=='text/html' else (payload or ''))
        elif filename and (cdisp == 'attachment' or cdisp != 'inline'):
            filename = sanitize_filename(decode_str(filename))
            payload = part.get_payload(decode=True) or b''
            size = len(payload)
            if size >= 10*1024*1024:
                attachments.append((filename, part.get_content_type(), size, None))
                continue
            apath = Path(ATT_DIR)/str(uid)/filename
            apath.parent.mkdir(parents=True, exist_ok=True)
            apath.write_bytes(payload)
            cursor.execute('INSERT INTO attachments(mail_uid, filename, mime, size, path) VALUES (?,?,?,?,?)', (uid, filename, part.get_content_type(), size, str(apath)))
            attachments.append((filename, part.get_content_type(), size, str(apath)))
    return '\n'.join(body_parts), attachments


def ensure_schema(conn):
    cur = conn.cursor()
    cur.execute('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)')
    cur.execute('CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY, subject_root TEXT, company_domain TEXT, status TEXT DEFAULT "open", first_msg_date TEXT, last_msg_date TEXT, message_count INT DEFAULT 0)')
    cur.execute('CREATE TABLE IF NOT EXISTS todos(id INTEGER PRIMARY KEY AUTOINCREMENT, mail_uid INT, text TEXT, deadline TEXT, done INT DEFAULT 0, source TEXT DEFAULT "body")')
    cur.execute('CREATE TABLE IF NOT EXISTS attachments(id INTEGER PRIMARY KEY AUTOINCREMENT, mail_uid INT, filename TEXT, mime TEXT, size INT, path TEXT)')
    cur.execute('CREATE TABLE IF NOT EXISTS links(id INTEGER PRIMARY KEY AUTOINCREMENT, mail_uid INT, url TEXT, context TEXT)')
    cols = [r[1] for r in cur.execute('PRAGMA table_info(mails)').fetchall()]
    if 'thread_id' not in cols:
        cur.execute('ALTER TABLE mails ADD COLUMN thread_id TEXT')
    todo_cols = [r[1] for r in cur.execute('PRAGMA table_info(todos)').fetchall()]
    if 'source' not in todo_cols:
        cur.execute('ALTER TABLE todos ADD COLUMN source TEXT DEFAULT "body"')
    conn.commit()


def upsert_thread(conn, thread_id, subject_root, company_domain, date):
    cur = conn.cursor()
    cur.execute('SELECT id,message_count FROM threads WHERE id=?', (thread_id,))
    row = cur.fetchone()
    if row:
        cur.execute('UPDATE threads SET last_msg_date=?, message_count=message_count+1 WHERE id=?', (date, thread_id))
    else:
        cur.execute('INSERT INTO threads(id, subject_root, company_domain, status, first_msg_date, last_msg_date, message_count) VALUES (?,?,?,?,?,?,1)',
                    (thread_id, subject_root, company_domain, 'open', date, date))


def process_message(conn, mail, full_body=False):
    uid, from_email, from_name, subject, date, mailbox, is_spam, body = mail
    msg = {'from_email': from_email or '', 'subject': subject or '', 'in_reply_to': '', 'references': ''}
    thread_id = get_thread_id(msg)
    subj_root = normalize_thread(subject or '')
    company_domain = get_domain(from_email or '')
    cur = conn.cursor()
    cur.execute('UPDATE mails SET thread_id=? WHERE uid=?', (thread_id, uid))
    upsert_thread(conn, thread_id, subj_root, company_domain, date)
    if is_spam:
        conn.commit()
        return
    cur.execute('SELECT COUNT(*) FROM attachments WHERE mail_uid=?', (uid,))
    has_att = (cur.fetchone()[0] or 0) > 0
    cur.execute('SELECT COUNT(*) FROM links WHERE mail_uid=?', (uid,))
    has_links = (cur.fetchone()[0] or 0) > 0
    cur.execute('DELETE FROM todos WHERE mail_uid=?', (uid,))
    if has_links:
        cur.execute('DELETE FROM links WHERE mail_uid=?', (uid,))
    if has_att:
        cur.execute('DELETE FROM attachments WHERE mail_uid=?', (uid,))
    content = body or subject or ''
    if full_body:
        try:
            M = fetch_imap_message(uid)
            if M:
                fetched, _ = process_body_content(M, uid, cur)
                if fetched:
                    content = fetched
                try: M.logout()
                except Exception: pass
        except Exception:
            pass
    # subject extraction
    for t in extract_todos(subject or '', source='subject', subject=subject or ''):
        cur.execute('INSERT INTO todos(mail_uid, text, deadline, done, source) VALUES (?,?,?,?,?)', (uid, t['text'], None, 0, t['source']))
    # body extraction
    for t in extract_todos(content, source='body', subject=subject or ''):
        cur.execute('INSERT INTO todos(mail_uid, text, deadline, done, source) VALUES (?,?,?,?,?)', (uid, t['text'], None, 0, t['source']))
    for u in extract_links(content):
        ctx = ''
        idx = content.find(u)
        if idx >= 0:
            ctx = content[max(0, idx-100):min(len(content), idx+len(u)+100)]
        cur.execute('INSERT INTO links(mail_uid, url, context) VALUES (?,?,?)', (uid, u, ctx))
    # attachments from full_body fetch handled above


def clear_mail_tables(conn):
    cur = conn.cursor()
    for t in ['mails','threads','todos','attachments','links']:
        cur.execute(f'DELETE FROM {t}')
    conn.commit()


def imap_reindex(conn, months=6, refresh_uid=False, full_body=False):
    cur = conn.cursor()
    before = {
        'mails': cur.execute('SELECT COUNT(*) FROM mails').fetchone()[0],
        'todos': cur.execute('SELECT COUNT(*) FROM todos').fetchone()[0],
        'attachments': cur.execute('SELECT COUNT(*) FROM attachments').fetchone()[0],
        'links': cur.execute('SELECT COUNT(*) FROM links').fetchone()[0],
    }
    env = load_env()
    host=env.get('IMAP_HOST'); user=env.get('IMAP_USER'); passwd=env.get('IMAP_PASS')
    port=int(env.get('IMAP_PORT','993')); tls=env.get('IMAP_TLS','true').lower()=='true'
    M = imaplib.IMAP4_SSL(host, port) if tls else imaplib.IMAP4(host, port)
    M.login(user, passwd)
    mailbox=env.get('IMAP_MAILBOX','INBOX')
    M.select(mailbox)
    since='19-Oct-2025'
    typ, data = M.uid('search', None, 'SINCE', since)
    uids = (data[0].split() if typ=='OK' and data and data[0] else [])
    # reuse cur below
    for uid in uids:
        st, msgdata = M.uid('fetch', uid, '(RFC822)')
        if st!='OK' or not msgdata or not msgdata[0] or not msgdata[0][1]:
            continue
        raw = msgdata[0][1]
        msg = email.message_from_bytes(raw, policy=policy.default)
        subject = decode_str(msg.get('Subject',''))
        from_name, from_email = '', ''
        addrs = getaddresses([msg.get('From','')])
        if addrs: from_name, from_email = addrs[0]
        date = decode_str(msg.get('Date',''))
        thread_id = get_thread_id({'from_email': from_email, 'subject': subject, 'in_reply_to': msg.get('In-Reply-To',''), 'references': msg.get('References','')})
        body_parts=[]
        for part in msg.walk():
            cdisp=(part.get_content_disposition() or '').lower(); ctype=part.get_content_type(); fn=part.get_filename()
            if ctype in ('text/plain','text/html') and cdisp!='attachment':
                payload=part.get_content(); body_parts.append(html_to_text(payload) if ctype=='text/html' else (payload or ''))
            elif fn and (cdisp=='attachment' or cdisp!='inline'):
                fn=sanitize_filename(decode_str(fn)); payload=part.get_payload(decode=True) or b''; size=len(payload)
                if size<10*1024*1024:
                    apath=Path(ATT_DIR)/str(uid.decode())/fn; apath.parent.mkdir(parents=True, exist_ok=True); apath.write_bytes(payload)
                    cur.execute('INSERT INTO attachments(mail_uid, filename, mime, size, path) VALUES (?,?,?,?,?)', (int(uid), fn, ctype, size, str(apath)))
        body='\n'.join(body_parts)
        cur.execute('INSERT OR REPLACE INTO mails(uid, from_email, from_name, subject, date, mailbox, is_spam, thread_id) VALUES (?,?,?,?,?,?,0,?)', (int(uid), from_email, from_name, subject, date, mailbox, thread_id))
        upsert_thread(conn, thread_id, normalize_thread(subject), get_domain(from_email), date)
        if 'spam' in subject.lower():
            continue
        for t in extract_todos(subject, source='subject', subject=subject):
            cur.execute('INSERT INTO todos(mail_uid, text, deadline, done, source) VALUES (?,?,?,?,?)', (int(uid), t['text'], None, 0, t['source']))
        for t in extract_todos(body, source='body', subject=subject):
            cur.execute('INSERT INTO todos(mail_uid, text, deadline, done, source) VALUES (?,?,?,?,?)', (int(uid), t['text'], None, 0, t['source']))
        for u in extract_links(body):
            cur.execute('INSERT INTO links(mail_uid, url, context) VALUES (?,?,?)', (int(uid), u, body[:400]))
    conn.commit(); M.logout()
    after = {
        'mails': cur.execute('SELECT COUNT(*) FROM mails').fetchone()[0],
        'todos': cur.execute('SELECT COUNT(*) FROM todos').fetchone()[0],
        'attachments': cur.execute('SELECT COUNT(*) FROM attachments').fetchone()[0],
        'links': cur.execute('SELECT COUNT(*) FROM links').fetchone()[0],
    }
    cur.execute('CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ran_at TEXT DEFAULT CURRENT_TIMESTAMP, mails_added INT DEFAULT 0, todos_added INT DEFAULT 0, attachments_added INT DEFAULT 0, links_added INT DEFAULT 0)')
    cur.execute('INSERT INTO runs(mails_added,todos_added,attachments_added,links_added) VALUES (?,?,?,?)', (
        max(0, after['mails']-before['mails']), max(0, after['todos']-before['todos']), max(0, after['attachments']-before['attachments']), max(0, after['links']-before['links'])
    ))
    conn.commit()


def stats(conn):
    cur = conn.cursor()
    tables = ['mails', 'threads', 'todos', 'attachments', 'links', 'meta']
    for t in tables:
        cur.execute(f'SELECT COUNT(*) FROM {t}')
        print(f'{t}: {cur.fetchone()[0]}')
    cur.execute('SELECT COALESCE(SUM(size),0) FROM attachments')
    print(f"attachments_mb: {round((cur.fetchone()[0] or 0)/1024/1024,2)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('months', nargs='?', default='6')
    ap.add_argument('--incremental', action='store_true')
    ap.add_argument('--reprocess', action='store_true')
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--full-body', action='store_true')
    ap.add_argument('--reindex-uids', action='store_true')
    ap.add_argument('--fresh', action='store_true')
    args = ap.parse_args()
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    cur = conn.cursor()
    if args.fresh:
        clear_mail_tables(conn)
        imap_reindex(conn, months=args.months, full_body=args.full_body)
    elif args.reindex_uids:
        clear_mail_tables(conn)
        imap_reindex(conn, months=args.months, refresh_uid=True, full_body=args.full_body)
    else:
        if args.incremental:
            cur.execute("SELECT COALESCE(CAST(value AS INTEGER),0) FROM meta WHERE key='last_uid'")
            row = cur.fetchone()
            last_uid = (row[0] if row else 0) or 0
            print('0 mail nuove')
            cur.execute('SELECT COALESCE(MAX(uid),0) FROM mails')
            row = cur.fetchone()
            max_uid = (row[0] if row else 0) or 0
            if max_uid > last_uid:
                cur.execute("INSERT INTO meta(key,value) VALUES('last_uid',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(max_uid),))
                conn.commit()
        if args.reprocess:
            mails = cur.execute('SELECT uid, from_email, from_name, subject, date, mailbox, is_spam, "" as body FROM mails ORDER BY uid').fetchall()
            for mail in mails:
                process_message(conn, mail, full_body=args.full_body)
            conn.commit()
    if args.stats:
        stats(conn)
    conn.close()

if __name__ == '__main__':
    main()
