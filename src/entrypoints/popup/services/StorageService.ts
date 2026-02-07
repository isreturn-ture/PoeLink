// StorageService.ts — 通过 background SQLite 存储，不再使用 browser.storage
import { createLogger } from '../../../utils/logger';
import communicationService from './CommunicationService';

const logStorage = createLogger('storage');

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  downloadUrl?: string;
  downloadLabel?: string;
  timeline?: any;
  rawThirdMsg?: unknown;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

interface LLMConfig {
  apiKey: string;
  provider: 'moonshot' | 'openai' | 'siliconflow';
  baseURL?: string;
  model?: string;
}

interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  streamSpeed: 'fast' | 'normal' | 'slow';
  autoSyncCookies: boolean;
}

interface Config {
  configId?: string;
  server: { protocol: 'HTTP' | 'HTTPS'; host: string; port: string };
  database: { address: string; user: string; pass: string };
  ops: { ip: string; port: string };
  llm?: LLMConfig;
  app?: AppSettings;
}

export interface DisclaimerState {
  agreed: boolean;
  dontShowAgain: boolean;
  updatedAt: number;
}

async function sendStorage<T = void>(type: string, payload?: Record<string, any>): Promise<T> {
  const res = await communicationService.sendMessageToBackground({ type, ...payload });
  if (res && typeof res === 'object' && (res as any).success === false) {
    throw new Error((res as any).error || '存储请求失败');
  }
  return res as T;
}

class StorageService {
  async setConfig(config: Config): Promise<void> {
    try {
      await sendStorage('STORAGE_SET_CONFIG', { config });
    } catch (error) {
      logStorage.error('保存配置失败', error);
      throw error;
    }
  }

  async getConfig(): Promise<Config | null> {
    try {
      const result = await sendStorage<Config | null>('STORAGE_GET_CONFIG');
      return result ?? null;
    } catch (error) {
      logStorage.error('获取配置失败', error);
      return null;
    }
  }

  async setMessages(messages: Message[]): Promise<void> {
    try {
      await sendStorage('STORAGE_SET_MESSAGES', { messages });
    } catch (error) {
      logStorage.error('保存消息失败', error);
      throw error;
    }
  }

  async getMessages(): Promise<Message[] | null> {
    try {
      const result = await sendStorage<Message[] | null>('STORAGE_GET_MESSAGES');
      return Array.isArray(result) ? result : null;
    } catch (error) {
      logStorage.error('获取消息失败', error);
      return null;
    }
  }

  async getSessions(): Promise<ChatSession[]> {
    try {
      const result = await sendStorage<ChatSession[] | undefined>('STORAGE_GET_SESSIONS');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      logStorage.error('获取会话失败', error);
      return [];
    }
  }

  async setSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await sendStorage('STORAGE_SET_SESSIONS', { sessions });
    } catch (error) {
      logStorage.error('保存会话失败', error);
      throw error;
    }
  }

  async getActiveSessionId(): Promise<string | null> {
    try {
      const id = await sendStorage<string | null>('STORAGE_GET_ACTIVE_SESSION_ID');
      return typeof id === 'string' && id ? id : null;
    } catch (error) {
      logStorage.error('获取当前会话失败', error);
      return null;
    }
  }

  async setActiveSessionId(sessionId: string): Promise<void> {
    try {
      await sendStorage('STORAGE_SET_ACTIVE_SESSION_ID', { sessionId });
    } catch (error) {
      logStorage.error('保存当前会话失败', error);
      throw error;
    }
  }

  async initSessions(): Promise<{ sessions: ChatSession[]; activeSessionId: string }> {
    try {
      const result = await sendStorage<{ sessions: ChatSession[]; activeSessionId: string }>('STORAGE_INIT_SESSIONS');
      if (!result || !result.sessions || !result.activeSessionId) {
        throw new Error('initSessions 返回无效');
      }
      return result;
    } catch (error) {
      logStorage.error('初始化会话失败', error);
      throw error;
    }
  }

  async createSession(initialMessages: Message[] = []): Promise<ChatSession> {
    try {
      const session = await sendStorage<ChatSession>('STORAGE_CREATE_SESSION', { messages: initialMessages });
      if (!session) throw new Error('createSession 返回无效');
      return session;
    } catch (error) {
      logStorage.error('创建会话失败', error);
      throw error;
    }
  }

  async activateSession(sessionId: string): Promise<ChatSession | null> {
    try {
      return await sendStorage<ChatSession | null>('STORAGE_ACTIVATE_SESSION', { sessionId });
    } catch (error) {
      logStorage.error('激活会话失败', error);
      return null;
    }
  }

  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    try {
      await sendStorage('STORAGE_UPDATE_SESSION_MESSAGES', { sessionId, messages });
    } catch (error) {
      logStorage.error('更新会话消息失败', error);
      throw error;
    }
  }

  async clearChatHistory(): Promise<void> {
    try {
      await sendStorage('STORAGE_CLEAR_CHAT_HISTORY');
    } catch (error) {
      logStorage.error('清除聊天记录失败', error);
      throw error;
    }
  }

  async getDisclaimerState(): Promise<DisclaimerState | null> {
    try {
      const state = await sendStorage<DisclaimerState | null>('STORAGE_GET_DISCLAIMER_STATE');
      if (!state || typeof state !== 'object' || typeof state.agreed !== 'boolean' || typeof state.dontShowAgain !== 'boolean' || typeof state.updatedAt !== 'number')
        return null;
      return state;
    } catch (error) {
      logStorage.error('获取免责声明状态失败', error);
      return null;
    }
  }

  async setDisclaimerState(state: Omit<DisclaimerState, 'updatedAt'> & { updatedAt?: number }): Promise<void> {
    try {
      const next: DisclaimerState = {
        agreed: Boolean(state.agreed),
        dontShowAgain: Boolean(state.dontShowAgain),
        updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : Date.now(),
      };
      await sendStorage('STORAGE_SET_DISCLAIMER_STATE', { state: next });
    } catch (error) {
      logStorage.error('保存免责声明状态失败', error);
      throw error;
    }
  }

  async getLLMConfig(): Promise<LLMConfig | null> {
    const config = await this.getConfig();
    return config?.llm ?? null;
  }

  async clearAll(): Promise<void> {
    try {
      await sendStorage('STORAGE_CLEAR_ALL');
    } catch (error) {
      logStorage.error('清除存储失败', error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const keys = await sendStorage<string[]>('STORAGE_GET_ALL_KEYS');
      return Array.isArray(keys) ? keys : [];
    } catch (error) {
      logStorage.error('获取存储键失败', error);
      return [];
    }
  }

  async hasKey(key: string): Promise<boolean> {
    try {
      const result = await sendStorage<boolean>('STORAGE_HAS_KEY', { key });
      return Boolean(result);
    } catch (error) {
      logStorage.error('检查存储键失败', error);
      return false;
    }
  }
}

const storageService = new StorageService();
export default storageService;
