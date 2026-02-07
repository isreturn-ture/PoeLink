/**
 * 存储相关消息处理：全部走 SQLite，不再使用 browser.storage
 */
import type { PoeLinkConfig, DisclaimerState, BackendStatus, ChatSession, Message } from '../db/sqlite';
import { getBackendServerConfig } from '../utils/config';
import { startBackendStatusMonitor, stopBackendStatusMonitor } from './backendStatusMonitor';
import {
  dbGetConfig,
  dbSetConfig,
  dbGetMessages,
  dbSetMessages,
  dbGetSessions,
  dbSetSessions,
  dbGetActiveSessionId,
  dbSetActiveSessionId,
  dbInitSessions,
  dbCreateSession,
  dbActivateSession,
  dbUpdateSessionMessages,
  dbClearChatHistory,
  dbGetDisclaimerState,
  dbSetDisclaimerState,
  dbGetBackendStatus,
  dbSetBackendStatus,
  dbClearAll,
  dbGetAllKeys,
  dbHasKey,
} from '../db/sqlite';

interface StorageRequest {
  config?: PoeLinkConfig;
  messages?: Message[];
  sessions?: ChatSession[];
  sessionId?: string;
  state?: DisclaimerState;
  key?: string;
  status?: BackendStatus;
  [k: string]: any;
}

export async function handleStorageMessage(type: string, req: StorageRequest): Promise<any> {
  switch (type) {
    case 'STORAGE_GET_CONFIG':
      return await dbGetConfig();
    case 'STORAGE_SET_CONFIG': {
      await dbSetConfig(req.config!);
      const server = await getBackendServerConfig();
      if (server?.host?.trim() && server?.port) {
        startBackendStatusMonitor();
      } else {
        stopBackendStatusMonitor();
      }
      return undefined;
    }
    case 'STORAGE_GET_MESSAGES':
      return await dbGetMessages();
    case 'STORAGE_SET_MESSAGES':
      await dbSetMessages((req.messages ?? []) as Message[]);
      return undefined;
    case 'STORAGE_GET_SESSIONS':
      return await dbGetSessions();
    case 'STORAGE_SET_SESSIONS':
      await dbSetSessions((req.sessions ?? []) as ChatSession[]);
      return undefined;
    case 'STORAGE_GET_ACTIVE_SESSION_ID':
      return await dbGetActiveSessionId();
    case 'STORAGE_SET_ACTIVE_SESSION_ID':
      await dbSetActiveSessionId(String(req.sessionId));
      return undefined;
    case 'STORAGE_INIT_SESSIONS':
      return await dbInitSessions();
    case 'STORAGE_CREATE_SESSION':
      return await dbCreateSession((req.messages ?? []) as Message[]);
    case 'STORAGE_ACTIVATE_SESSION':
      return await dbActivateSession(String(req.sessionId));
    case 'STORAGE_UPDATE_SESSION_MESSAGES':
      await dbUpdateSessionMessages(String(req.sessionId), (req.messages ?? []) as Message[]);
      return undefined;
    case 'STORAGE_CLEAR_CHAT_HISTORY':
      await dbClearChatHistory();
      return undefined;
    case 'STORAGE_GET_DISCLAIMER_STATE':
      return await dbGetDisclaimerState();
    case 'STORAGE_SET_DISCLAIMER_STATE':
      await dbSetDisclaimerState(req.state!);
      return undefined;
    case 'STORAGE_GET_LLM_CONFIG': {
      const config = await dbGetConfig();
      return config?.llm ?? null;
    }
    case 'STORAGE_CLEAR_ALL':
      await dbClearAll();
      return undefined;
    case 'STORAGE_GET_ALL_KEYS':
      return await dbGetAllKeys();
    case 'STORAGE_HAS_KEY':
      return await dbHasKey(String(req.key));
    case 'STORAGE_GET_BACKEND_STATUS':
      return await dbGetBackendStatus();
    case 'STORAGE_SET_BACKEND_STATUS':
      await dbSetBackendStatus(req.status!);
      return undefined;
    default:
      return undefined;
  }
}
