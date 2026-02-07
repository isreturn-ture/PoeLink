/**
 * SQLite 表结构：配置、会话、消息、免责声明、后端状态等
 */
export const SCHEMA_SQL = `
-- 单行键值（配置、当前会话 ID、免责声明、后端状态等）
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 聊天会话列表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  messages_json TEXT NOT NULL
);

-- 当前激活的会话 ID 存在 kv 表：active_session_id
`;

export const KV_KEYS = {
  CONFIG: 'poelink_config',
  ACTIVE_SESSION_ID: 'poelink_active_session_id',
  DISCLAIMER: 'poelink_disclaimer_state',
  BACKEND_STATUS: 'poelink_backend_status',
} as const;
