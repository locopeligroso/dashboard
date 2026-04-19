-- 001_schema.sql — idempotent schema extensions for CRM dashboard v2
-- Note: ALTER TABLE ADD COLUMN is not idempotent in SQLite; handled in apply.py via PRAGMA check.

PRAGMA journal_mode = DELETE;

CREATE TABLE IF NOT EXISTS company_categories (
    domain TEXT PRIMARY KEY,
    category TEXT CHECK(category IN ('client','vendor','award','newsletter','internal','unknown')) DEFAULT 'unknown',
    notes TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_todos_done ON todos(done);
CREATE INDEX IF NOT EXISTS idx_todos_mail_uid ON todos(mail_uid);
CREATE INDEX IF NOT EXISTS idx_threads_last ON threads(last_msg_date);
CREATE INDEX IF NOT EXISTS idx_threads_domain ON threads(company_domain);
CREATE INDEX IF NOT EXISTS idx_mails_thread ON mails(thread_id);
CREATE INDEX IF NOT EXISTS idx_mails_date ON mails(date);
CREATE INDEX IF NOT EXISTS idx_mails_from ON mails(from_email);
CREATE INDEX IF NOT EXISTS idx_attachments_mail ON attachments(mail_uid);
CREATE INDEX IF NOT EXISTS idx_links_mail ON links(mail_uid);
