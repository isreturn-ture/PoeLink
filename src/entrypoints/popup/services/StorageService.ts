// StorageService.ts
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LLMConfig {
  apiKey: string;
  provider: 'moonshot' | 'openai';
  baseURL?: string;
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
}

class StorageService {
  /**
   * 保存配置到本地存储
   */
  async setConfig(config: Config): Promise<void> {
    try {
      await browser.storage.local.set({ poelink_config: config });
    } catch (error) {
      console.error('保存配置失败:', error);
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
      console.error('获取配置失败:', error);
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
      console.error('保存消息失败:', error);
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
      console.error('获取消息失败:', error);
      return null;
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
      await browser.storage.local.remove(['poelink_config', 'poelink_messages']);
    } catch (error) {
      console.error('清除存储失败:', error);
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
      console.error('获取存储键失败:', error);
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
      console.error('检查存储键失败:', error);
      return false;
    }
  }
}

const storageService = new StorageService();
export default storageService;