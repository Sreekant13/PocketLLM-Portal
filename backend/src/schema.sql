CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY, name TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS messages(
  id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, ts INTEGER
);
CREATE TABLE IF NOT EXISTS cache_entries(
  key TEXT PRIMARY KEY, value TEXT, created_at INTEGER, ttl_ms INTEGER
);
