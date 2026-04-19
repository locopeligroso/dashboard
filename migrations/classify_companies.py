#!/usr/bin/env python3
"""Data-driven company classification.

Categories: client | vendor | award | newsletter | internal | unknown
Rules (evaluated top to bottom, first match wins):
  1. domain contains 'verganiegasco' → internal
  2. regex prefix news./email./mailing./comms./noreply/mailer/notifications/e./mail.
     OR contains 'newsletter' OR 'unsubscribe' → newsletter
  3. contains 'award' (singular or plural) → award
  4. domain in VENDORS list → vendor
  5. email_count >= 3 AND thread_count >= 3 → client
  6. otherwise → unknown

The table company_categories is populated with INSERT OR REPLACE.
"""
import re
import sqlite3
import sys
from pathlib import Path

DB = Path('/home/node/.openclaw/workspace/mail-db.sqlite')

NEWSLETTER_RE = re.compile(
    r'(?:^(?:news|email|mailing|comms|noreply|no-reply|mailer|notifications|e|mail|reply|notify|info|hello|contact)\.'
    r'|newsletter|unsubscribe|mktng|emktng|broadcast)',
    re.IGNORECASE,
)

VENDORS = {
    'wetransfer.com', 'we.tl', 'wetransfer.zendesk.com',
    'google.com', 'gmail.com', 'accounts.google.com', 'youtube.com',
    'topazlabs.com',
    'runwayml.com', 'comms.runwayml.com',
    'turbosquid.com', 'emktng.turbosquid.com',
    'zoom.com', 'zoom.us',
    'figma.com', 'email.figma.com',
    'autodesk.com', 'autodeskcommunications.com',
    'sketchfab.com',
    'cgtrader.com', 'mailing.cgtrader.com',
    'slack.com',
    'microsoft.com', 'office.com', 'outlook.com',
    'apple.com',
    'dropbox.com',
    'adobe.com',
    'spline.design', 'mail.spline.design',
    'notion.so', 'notion.com',
    'stripe.com',
    'github.com',
    'linkedin.com',
    'paypal.com',
    'amazon.com', 'aws.amazon.com',
    'cloudflare.com',
    'artlist.io', 'clicks.artlist.io',
    'tinyurl.com',
    'facebook.com',
    'instagram.com',
    'twitter.com', 'x.com',
    'mailchimp.com', 'mailchi.mp',
    'sendgrid.net',
    'intercom.io',
}


def classify(domain: str, email_count: int, thread_count: int) -> str:
    d = (domain or '').lower()
    if not d:
        return 'unknown'
    if 'verganiegasco' in d:
        return 'internal'
    if NEWSLETTER_RE.search(d):
        return 'newsletter'
    if re.search(r'awards?\b', d):
        return 'award'
    if d in VENDORS or any(d.endswith('.' + v) or d == v for v in VENDORS):
        return 'vendor'
    if email_count >= 3 and thread_count >= 3:
        return 'client'
    return 'unknown'


def main() -> int:
    if not DB.exists():
        print(f"ERR: db not found at {DB}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT c.domain, c.email_count,
               COALESCE(t.thread_count, 0) AS thread_count
        FROM companies c
        LEFT JOIN (
            SELECT company_domain AS domain, COUNT(*) AS thread_count
            FROM threads GROUP BY company_domain
        ) t ON t.domain = c.domain
        """
    ).fetchall()

    counts = {'client': 0, 'vendor': 0, 'award': 0, 'newsletter': 0, 'internal': 0, 'unknown': 0}
    for r in rows:
        cat = classify(r['domain'], r['email_count'] or 0, r['thread_count'] or 0)
        counts[cat] += 1
        conn.execute(
            """
            INSERT INTO company_categories(domain, category, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(domain) DO UPDATE SET
                category=excluded.category,
                updated_at=CURRENT_TIMESTAMP
            WHERE company_categories.notes IS NULL OR company_categories.notes = ''
            """,
            (r['domain'], cat),
        )
    conn.commit()

    print("Classified", len(rows), "domains")
    for k in ('client', 'vendor', 'award', 'newsletter', 'internal', 'unknown'):
        print(f"  {k}: {counts[k]}")

    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
