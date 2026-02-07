/**
 * Background 内 SQLite 存储层：使用 sql.js，持久化到 IndexedDB
 * 配置、会话、消息、免责声明、后端状态等均存于此，不再使用 browser.storage
 */
import { browser } from 'wxt/browser';
import { createLogger } from '../../../utils/logger';
import { loadDbFromIndexedDB, saveDbToIndexedDB } from './indexedDB';
import { SCHEMA_SQL, KV_KEYS } from './schema';

const logDb = createLogger('db');

export interface PoeLinkConfig {
  configId?: string;
  server: { protocol: string; host: string; port: string };
  database?: { address: string; user: string; pass: string };
  ops?: { ip: string; port: string };
  llm?: { apiKey: string; provider: string; baseURL?: string; model?: string };
  app?: Record<string, unknown>;
}

export interface BackendStatus {
  online: boolean;
  lastCheck: number;
  checking?: boolean;
  error?: string;
}

export interface DisclaimerState {
  agreed: boolean;
  dontShowAgain: boolean;
  updatedAt: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  downloadUrl?: string;
  downloadLabel?: string;
  timeline?: unknown;
  rawThirdMsg?: unknown;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

type SqlJsDatabase = import('sql.js').Database;
let db: SqlJsDatabase | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const initSqlJs = (await import('sql.js')).default;
    const wasmUrl = browser.runtime.getURL('/sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const buffer = await loadDbFromIndexedDB();
    const database = new SQL.Database(buffer ?? undefined);
    database.run(SCHEMA_SQL);
    const hadData = kvGet(database, KV_KEYS.CONFIG) != null;
    if (!hadData) {
      await migrateFromBrowserStorage(database);
    }
    db = database;
    logDb.info('SQLite DB 已初始化（IndexedDB 持久化）');
    return database;
  })();
  return initPromise;
}

/** 首次使用时从 browser.storage.local 迁移到 SQLite（一次性） */
async function migrateFromBrowserStorage(database: SqlJsDatabase): Promise<void> {
  try {
    const keys = [
      'poelink_config',
      'poelink_active_session_id',
      'poelink_disclaimer_state',
      'poelink_backend_status',
      'poelink_messages',
      'poelink_sessions',
    ];
    const result = await browser.storage.local.get(keys);
    if (result.poelink_config) {
      kvSet(database, KV_KEYS.CONFIG, JSON.stringify(result.poelink_config));
      logDb.info('已迁移 poelink_config 到 SQLite');
    }
    if (typeof result.poelink_active_session_id === 'string' && result.poelink_active_session_id) {
      kvSet(database, KV_KEYS.ACTIVE_SESSION_ID, result.poelink_active_session_id);
    }
    if (result.poelink_disclaimer_state && typeof result.poelink_disclaimer_state === 'object') {
      kvSet(database, KV_KEYS.DISCLAIMER, JSON.stringify(result.poelink_disclaimer_state));
    }
    if (result.poelink_backend_status && typeof result.poelink_backend_status === 'object') {
      kvSet(database, KV_KEYS.BACKEND_STATUS, JSON.stringify(result.poelink_backend_status));
    }
    const sessions = result.poelink_sessions as ChatSession[] | undefined;
    if (Array.isArray(sessions) && sessions.length > 0) {
      database.run('DELETE FROM sessions');
      const insert = database.prepare('INSERT INTO sessions (id, title, created_at, updated_at, messages_json) VALUES (?, ?, ?, ?, ?)');
      for (const s of sessions) {
        if (s?.id) {
          insert.run([
            s.id,
            s.title ?? '',
            s.createdAt ?? 0,
            s.updatedAt ?? 0,
            JSON.stringify(s.messages ?? []),
          ]);
        }
      }
      insert.free();
      logDb.info('已迁移会话列表到 SQLite');
    } else if (Array.isArray(result.poelink_messages) && result.poelink_messages.length > 0) {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const now = Date.now();
      const msgs = result.poelink_messages as Message[];
      const firstUser = msgs.find(m => m?.role === 'user' && typeof m.content === 'string');
      const title = firstUser?.content?.replace(/\s+/g, ' ').trim().slice(0, 24) || '新会话';
      database.run('DELETE FROM sessions');
      const insert = database.prepare('INSERT INTO sessions (id, title, created_at, updated_at, messages_json) VALUES (?, ?, ?, ?, ?)');
      insert.run([id, title, now, now, JSON.stringify(msgs)]);
      insert.free();
      kvSet(database, KV_KEYS.ACTIVE_SESSION_ID, id);
      logDb.info('已迁移旧版消息到 SQLite 会话');
    }
    const data = database.export();
    await saveDbToIndexedDB(data);
    await browser.storage.local.remove(keys);
  } catch (e) {
    logDb.warn('从 browser.storage 迁移失败，将使用空库', e);
  }
}

async function persist(): Promise<void> {
  if (!db) return;
  try {
    const data = db.export();
    await saveDbToIndexedDB(data);
  } catch (e) {
    logDb.error('持久化到 IndexedDB 失败', e);
  }
}

function kvGet(database: SqlJsDatabase, key: string): string | null {
  const stmt = database.prepare('SELECT value FROM kv WHERE key = ?');
  stmt.bind([key]);
  const hasRow = stmt.step();
  const value = hasRow ? stmt.get()[0] : null;
  stmt.free();
  return value as string | null;
}

function kvSet(database: SqlJsDatabase, key: string, value: string): void {
  const stmt = database.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');
  stmt.run([key, value]);
  stmt.free();
}

function kvDelete(database: SqlJsDatabase, key: string): void {
  const stmt = database.prepare('DELETE FROM kv WHERE key = ?');
  stmt.run([key]);
  stmt.free();
}

// --- Config
export async function dbGetConfig(): Promise<PoeLinkConfig | null> {
  const database = await getDb();
  const raw = kvGet(database, KV_KEYS.CONFIG);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as PoeLinkConfig;
  } catch {
    return null;
  }
}

export async function dbSetConfig(config: PoeLinkConfig): Promise<void> {
  const database = await getDb();
  kvSet(database, KV_KEYS.CONFIG, JSON.stringify(config));
  await persist();
}

// --- Sessions & messages
export async function dbGetSessions(): Promise<ChatSession[]> {
  const database = await getDb();
  const stmt = database.prepare('SELECT id, title, created_at, updated_at, messages_json FROM sessions ORDER BY updated_at DESC');
  const sessions: ChatSession[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    try {
      sessions.push({
        id: row[0] as string,
        title: row[1] as string,
        createdAt: row[2] as number,
        updatedAt: row[3] as number,
        messages: JSON.parse((row[4] as string) || '[]') as Message[],
      });
    } catch {
      // skip invalid row
    }
  }
  stmt.free();
  return sessions;
}

export async function dbSetSessions(sessions: ChatSession[]): Promise<void> {
  const database = await getDb();
  database.run('DELETE FROM sessions');
  const insert = database.prepare('INSERT INTO sessions (id, title, created_at, updated_at, messages_json) VALUES (?, ?, ?, ?, ?)');
  for (const s of sessions) {
    insert.run([s.id, s.title, s.createdAt, s.updatedAt, JSON.stringify(s.messages || [])]);
  }
  insert.free();
  await persist();
}

export async function dbGetActiveSessionId(): Promise<string | null> {
  const database = await getDb();
  const id = kvGet(database, KV_KEYS.ACTIVE_SESSION_ID);
  return id && typeof id === 'string' ? id : null;
}

export async function dbSetActiveSessionId(sessionId: string): Promise<void> {
  const database = await getDb();
  kvSet(database, KV_KEYS.ACTIVE_SESSION_ID, sessionId);
  await persist();
}

// --- Messages: 当前激活会话的消息由“当前会话”的 messages 表示，这里仅兼容旧接口：用 active 会话的 messages
export async function dbGetMessages(): Promise<Message[] | null> {
  const database = await getDb();
  const activeId = kvGet(database, KV_KEYS.ACTIVE_SESSION_ID);
  if (!activeId) return null;
  const stmt = database.prepare('SELECT messages_json FROM sessions WHERE id = ?');
  stmt.bind([activeId]);
  const hasRow = stmt.step();
  const json = hasRow ? (stmt.get()[0] as string) : null;
  stmt.free();
  if (json == null) return null;
  try {
    return JSON.parse(json) as Message[];
  } catch {
    return null;
  }
}

export async function dbSetMessages(messages: Message[]): Promise<void> {
  const database = await getDb();
  const activeId = kvGet(database, KV_KEYS.ACTIVE_SESSION_ID);
  if (!activeId) return;
  const stmt = database.prepare('UPDATE sessions SET messages_json = ?, updated_at = ? WHERE id = ?');
  stmt.run([JSON.stringify(messages), Date.now(), activeId]);
  stmt.free();
  await persist();
}

// --- Disclaimer
export async function dbGetDisclaimerState(): Promise<DisclaimerState | null> {
  const database = await getDb();
  const raw = kvGet(database, KV_KEYS.DISCLAIMER);
  if (raw == null) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === 'object' && typeof (o as DisclaimerState).agreed === 'boolean' && typeof (o as DisclaimerState).dontShowAgain === 'boolean' && typeof (o as DisclaimerState).updatedAt === 'number')
      return o as DisclaimerState;
    return null;
  } catch {
    return null;
  }
}

export async function dbSetDisclaimerState(state: DisclaimerState): Promise<void> {
  const database = await getDb();
  kvSet(database, KV_KEYS.DISCLAIMER, JSON.stringify(state));
  await persist();
}

// --- Backend status
export async function dbGetBackendStatus(): Promise<BackendStatus | null> {
  const database = await getDb();
  const raw = kvGet(database, KV_KEYS.BACKEND_STATUS);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as BackendStatus;
  } catch {
    return null;
  }
}

export async function dbSetBackendStatus(status: BackendStatus): Promise<void> {
  const database = await getDb();
  kvSet(database, KV_KEYS.BACKEND_STATUS, JSON.stringify(status));
  await persist();
}

// --- Helpers
export async function dbClearChatHistory(): Promise<void> {
  const database = await getDb();
  database.run('DELETE FROM sessions');
  kvDelete(database, KV_KEYS.ACTIVE_SESSION_ID);
  await persist();
}

export async function dbClearAll(): Promise<void> {
  const database = await getDb();
  database.run('DELETE FROM kv');
  database.run('DELETE FROM sessions');
  await persist();
}

export async function dbGetAllKeys(): Promise<string[]> {
  const database = await getDb();
  const stmt = database.prepare('SELECT key FROM kv');
  const keys: string[] = [];
  while (stmt.step()) keys.push(stmt.get()[0] as string);
  stmt.free();
  return keys;
}

export async function dbHasKey(key: string): Promise<boolean> {
  const database = await getDb();
  const v = kvGet(database, key);
  return v != null;
}

// --- Session helpers (mirror StorageService logic)
function genSessionId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function deriveSessionTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m?.role === 'user' && typeof m.content === 'string' && m.content.trim());
  const basis = firstUser?.content ?? messages.find(m => typeof m?.content === 'string' && m.content.trim())?.content;
  const title = String(basis ?? '').replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 24) : '新会话';
}

export async function dbInitSessions(): Promise<{ sessions: ChatSession[]; activeSessionId: string }> {
  let sessions = await dbGetSessions();
  let active = await dbGetActiveSessionId();
  if (sessions.length > 0 && active && sessions.some(s => s.id === active)) {
    return { sessions, activeSessionId: active };
  }
  if (sessions.length > 0) {
    const sorted = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const picked = sorted[0];
    await dbSetActiveSessionId(picked.id);
    await dbSetMessages(Array.isArray(picked.messages) ? picked.messages : []);
    return { sessions, activeSessionId: picked.id };
  }
  const legacy = await dbGetMessages();
  const id = genSessionId();
  const now = Date.now();
  const migratedMessages = Array.isArray(legacy) ? legacy : [];
  const session: ChatSession = {
    id,
    title: deriveSessionTitle(migratedMessages),
    createdAt: now,
    updatedAt: now,
    messages: migratedMessages,
  };
  await dbSetSessions([session]);
  await dbSetActiveSessionId(id);
  await dbSetMessages(migratedMessages);
  return { sessions: [session], activeSessionId: id };
}

export async function dbCreateSession(initialMessages: Message[] = []): Promise<ChatSession> {
  const sessions = await dbGetSessions();
  const id = genSessionId();
  const now = Date.now();
  const session: ChatSession = {
    id,
    title: deriveSessionTitle(initialMessages),
    createdAt: now,
    updatedAt: now,
    messages: Array.isArray(initialMessages) ? initialMessages : [],
  };
  const next = [session, ...sessions];
  await dbSetSessions(next);
  await dbSetActiveSessionId(id);
  await dbSetMessages(session.messages);
  return session;
}

export async function dbActivateSession(sessionId: string): Promise<ChatSession | null> {
  const sessions = await dbGetSessions();
  const target = sessions.find(s => s?.id === sessionId) ?? null;
  if (!target) return null;
  await dbSetActiveSessionId(sessionId);
  await dbSetMessages(Array.isArray(target.messages) ? target.messages : []);
  return target;
}

export async function dbUpdateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
  const sessions = await dbGetSessions();
  const now = Date.now();
  let found = false;
  const next = sessions.map((s) => {
    if (s.id !== sessionId) return s;
    found = true;
    const nextMessages = Array.isArray(messages) ? messages : [];
    const title = typeof s.title === 'string' && s.title.trim() ? s.title : deriveSessionTitle(nextMessages);
    return { ...s, title, messages: nextMessages, updatedAt: now };
  });
  if (!found) {
    const nextMessages = Array.isArray(messages) ? messages : [];
    next.unshift({
      id: sessionId,
      title: deriveSessionTitle(nextMessages),
      createdAt: now,
      updatedAt: now,
      messages: nextMessages,
    });
  }
  next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  await dbSetSessions(next);
  await dbSetMessages(Array.isArray(messages) ? messages : []);
}
