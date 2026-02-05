// StorageService.ts
import { createLogger } from '../../../utils/logger';

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

function genSessionId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function deriveSessionTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim());
  const basis = firstUser?.content ?? messages.find(m => m && typeof m.content === 'string' && m.content.trim())?.content;
  const title = String(basis ?? '').replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 24) : '新会话';
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
  server: {
    protocol: 'HTTP' | 'HTTPS';
    host: string;
    port: string;
  };
  database: {
    address: string;
    user: string;
    pass: string;
  };
  ops: {
    ip: string;
    port: string;
  };
  llm?: LLMConfig;
  app?: AppSettings;
}

class StorageService {
  /**
   * 保存配置到本地存储
   */
  async setConfig(config: Config): Promise<void> {
    try {
      await browser.storage.local.set({ poelink_config: config });
    } catch (error) {
      logStorage.error('保存配置失败', error);
      throw error;
    }
  }

  /**
   * 从本地存储获取配置
   */
  async getConfig(): Promise<Config | null> {
    try {
      const result = await browser.storage.local.get(['poelink_config']);
      return (result.poelink_config as Config) || null;
    } catch (error) {
      logStorage.error('获取配置失败', error);
      return null;
    }
  }

  /**
   * 保存消息到本地存储
   */
  async setMessages(messages: Message[]): Promise<void> {
    try {
      await browser.storage.local.set({ poelink_messages: messages });
    } catch (error) {
      logStorage.error('保存消息失败', error);
      throw error;
    }
  }

  /**
   * 从本地存储获取消息
   */
  async getMessages(): Promise<Message[] | null> {
    try {
      const result = await browser.storage.local.get(['poelink_messages']);
      return (result.poelink_messages as Message[]) || null;
    } catch (error) {
      logStorage.error('获取消息失败', error);
      return null;
    }
  }

  async getSessions(): Promise<ChatSession[]> {
    try {
      const result = await browser.storage.local.get(['poelink_sessions']);
      const sessions = result.poelink_sessions as ChatSession[] | undefined;
      return Array.isArray(sessions) ? sessions : [];
    } catch (error) {
      logStorage.error('获取会话失败', error);
      return [];
    }
  }

  async setSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await browser.storage.local.set({ poelink_sessions: sessions });
    } catch (error) {
      logStorage.error('保存会话失败', error);
      throw error;
    }
  }

  async getActiveSessionId(): Promise<string | null> {
    try {
      const result = await browser.storage.local.get(['poelink_active_session_id']);
      const id = result.poelink_active_session_id;
      return typeof id === 'string' && id ? id : null;
    } catch (error) {
      logStorage.error('获取当前会话失败', error);
      return null;
    }
  }

  async setActiveSessionId(sessionId: string): Promise<void> {
    try {
      await browser.storage.local.set({ poelink_active_session_id: sessionId });
    } catch (error) {
      logStorage.error('保存当前会话失败', error);
      throw error;
    }
  }

  async initSessions(): Promise<{ sessions: ChatSession[]; activeSessionId: string }> {
    const sessions = await this.getSessions();
    const active = await this.getActiveSessionId();
    if (sessions.length > 0 && active && sessions.some(s => s.id === active)) {
      return { sessions, activeSessionId: active };
    }

    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)));
      const picked = sorted[0];
      await this.setActiveSessionId(picked.id);
      await this.setMessages(picked.messages || []);
      return { sessions, activeSessionId: picked.id };
    }

    const legacy = await this.getMessages();
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
    await this.setSessions([session]);
    await this.setActiveSessionId(id);
    await this.setMessages(migratedMessages);
    return { sessions: [session], activeSessionId: id };
  }

  async createSession(initialMessages: Message[] = []): Promise<ChatSession> {
    const sessions = await this.getSessions();
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
    await this.setSessions(next);
    await this.setActiveSessionId(id);
    await this.setMessages(session.messages);
    return session;
  }

  async activateSession(sessionId: string): Promise<ChatSession | null> {
    const sessions = await this.getSessions();
    const target = sessions.find(s => s && s.id === sessionId) || null;
    if (!target) return null;
    await this.setActiveSessionId(sessionId);
    await this.setMessages(Array.isArray(target.messages) ? target.messages : []);
    return target;
  }

  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    const sessions = await this.getSessions();
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

    next.sort((a, b) => (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)));
    await this.setSessions(next);
    await this.setMessages(Array.isArray(messages) ? messages : []);
  }

  async clearChatHistory(): Promise<void> {
    try {
      await browser.storage.local.remove(['poelink_messages', 'poelink_sessions', 'poelink_active_session_id']);
    } catch (error) {
      logStorage.error('清除聊天记录失败', error);
      throw error;
    }
  }

  /**
   * 清除所有存储的数据
   */
  /**
   * 获取 LLM 配置（API Key 等）
   */
  async getLLMConfig(): Promise<LLMConfig | null> {
    const config = await this.getConfig();
    return config?.llm ?? null;
  }

  async clearAll(): Promise<void> {
    try {
      await browser.storage.local.remove(['poelink_config', 'poelink_messages', 'poelink_sessions', 'poelink_active_session_id']);
    } catch (error) {
      logStorage.error('清除存储失败', error);
      throw error;
    }
  }

  /**
   * 获取存储的所有键
   */
  async getAllKeys(): Promise<string[]> {
    try {
      return await browser.storage.local.getKeys();
    } catch (error) {
      logStorage.error('获取存储键失败', error);
      return [];
    }
  }

  /**
   * 检查存储是否包含指定键
   */
  async hasKey(key: string): Promise<boolean> {
    try {
      const result = await browser.storage.local.get([key]);
      return key in result;
    } catch (error) {
      logStorage.error('检查存储键失败', error);
      return false;
    }
  }
}

const storageService = new StorageService();
export default storageService;