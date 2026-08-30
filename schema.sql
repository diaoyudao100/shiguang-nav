-- 拾光导航 D1 数据库结构
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  password_hash TEXT,
  name          TEXT NOT NULL,
  avatar        TEXT,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'admin' | 'user'
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'disabled'
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS oauth_identities (
  provider     TEXT NOT NULL,                   -- 'google' | 'linuxdo' | 'wechat'
  provider_uid TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (provider, provider_uid)
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,
  created_by TEXT,
  max_uses   INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,                            -- 毫秒时间戳，NULL = 永久
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_data (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  data       TEXT NOT NULL,                      -- 整份导航数据 JSON
  updated_at INTEGER NOT NULL
);
