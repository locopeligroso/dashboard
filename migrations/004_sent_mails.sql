PRAGMA journal_mode = DELETE;

CREATE TABLE IF NOT EXISTS sent_mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    in_reply_to_uid INTEGER,
    thread_id TEXT,
    to_emails TEXT NOT NULL,
    cc_emails TEXT,
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    attachments_json TEXT,
    message_id TEXT,
    status TEXT CHECK(status IN ('pending','sent','error')) DEFAULT 'pending',
    error TEXT,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sent_thread ON sent_mails(thread_id);
CREATE INDEX IF NOT EXISTS idx_sent_reply ON sent_mails(in_reply_to_uid);
