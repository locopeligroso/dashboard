-- 002: projects hierarchy + chat with Napoleon per entity
PRAGMA journal_mode = DELETE;

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_domain TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT CHECK(status IN ('active','paused','done','archived')) DEFAULT 'active',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_domain) REFERENCES companies(domain)
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_domain);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- chat threads bind to any entity (client/project/thread/mail/task/attachment/link)
CREATE TABLE IF NOT EXISTS chat_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT CHECK(entity_type IN ('client','project','thread','mail','task','attachment','link')) NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_entity ON chat_threads(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_thread_id INTEGER NOT NULL,
    role TEXT CHECK(role IN ('user','napoleon','system')) NOT NULL,
    content TEXT NOT NULL,
    status TEXT CHECK(status IN ('ok','pending','error')) DEFAULT 'ok',
    error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(chat_thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
