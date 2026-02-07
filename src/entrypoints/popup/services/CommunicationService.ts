import { browser } from 'wxt/browser';
import { createLogger } from '../../../utils/logger';

const logComm = createLogger('comm');

interface Message {
  type: string;
  [key: string]: any;
}

interface ServerConfig {
  host: string;
  port: number;
  protocol: string;
  ip?: string;
}

interface PoeLinkConfig {
  server: ServerConfig;
  database?: any;
  ops?: any;
}

class CommunicationService {
  /**
   * 向后台脚本发送消息
   */
  async sendMessageToBackground(message: Message): Promise<any> {
    try {
      const response = await browser.runtime.sendMessage(message);
      return response;
    } catch (error) {
      logComm.error('向后台发送消息失败', error);
      throw error;
    }
  }

  /**
   * 监听来自后台的消息
   */
  onMessageFromBackground(callback: (message: Message, sender: any, sendResponse: (response?: any) => void) => boolean | undefined): () => void {
    const listener = (message: Message, sender: any, sendResponse: (response?: any) => void) => {
      return callback(message, sender, sendResponse);
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }

  /**
   * 调用后端API (通过后台代理以避免CORS)
   */
  async callApi(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      // 通过后台代理请求
      return await this.sendMessageToBackground({
        type: 'PROXY_REQUEST',
        endpoint,
        options
      });
    } catch (error) {
      logComm.error('API 调用失败', error);
      throw error;
    }
  }

  async callApiJson<T = any>(
    endpoint: string,
    params: {
      method?: string;
      query?: Record<string, string | number | boolean | null | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    const method = (params.method || 'GET').toUpperCase();
    const query = params.query || {};
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      qs.set(k, String(v));
    }
    const withQuery = qs.toString() ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${qs.toString()}` : endpoint;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(params.headers || {})
    };

    const init: RequestInit & { timeoutMs?: number } = {
      method,
      headers,
      signal: params.signal,
      timeoutMs: params.timeoutMs,
    };

    if (method !== 'GET' && method !== 'HEAD' && params.body !== undefined) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      init.body = typeof params.body === 'string' ? params.body : JSON.stringify(params.body);
    }

    return await this.callApi(withQuery, init);
  }

  async callExternalJson<T = any>(
    url: string,
    params: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    const method = (params.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      ...(params.headers || {})
    };

    const init: RequestInit & { timeoutMs?: number } = {
      method,
      headers,
      signal: params.signal,
      timeoutMs: params.timeoutMs,
    };

    if (method !== 'GET' && method !== 'HEAD' && params.body !== undefined) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      init.body = typeof params.body === 'string' ? params.body : JSON.stringify(params.body);
    }

    return await this.sendMessageToBackground({
      type: 'EXTERNAL_REQUEST',
      url,
      options: init,
    });
  }

  /**
   * 验证配置
   */
  async validateConfig(config: any): Promise<any> {
    return this.sendMessageToBackground({
      type: 'VALIDATE_CONFIG',
      config: config
    });
  }

  /**
   * 同步Cookie
   */
  async syncCookies(data: any): Promise<any> {
    return this.sendMessageToBackground({
      type: 'SYNC_COOKIES',
      data: data
    });
  }

  /**
   * 获取Cookie
   */
  async getCookies(server: any): Promise<any> {
    return this.sendMessageToBackground({
      type: 'GET_COOKIES',
      server: server
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(server: any): Promise<any> {
    return this.sendMessageToBackground({
      type: 'HEALTH_CHECK',
      server: server
    });
  }

  /**
   * 获取后端实时状态（在线/离线）
   * @param immediate 是否立即触发一次检测
   */
  async getBackendStatus(immediate = false): Promise<{ online: boolean; lastCheck: number; checking?: boolean; error?: string } | null> {
    return this.sendMessageToBackground({
      type: 'GET_BACKEND_STATUS',
      immediate
    });
  }

  /**
   * 下载日志
   */
  async downloadLog(filename: string): Promise<any> {
    return this.sendMessageToBackground({
      type: 'DOWNLOAD_LOG',
      filename: filename
    });
  }

  /**
   * 发送通知
   */
  async sendNotification(options: any): Promise<void> {
    try {
      const notificationsApi = browser?.notifications;
      logComm.debug('[Notify] request', options);
      if (typeof Notification !== 'undefined') {
        logComm.debug('[Notify] permission before', Notification.permission);
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
          logComm.debug('[Notify] permission after request', Notification.permission);
        }
        if (Notification.permission === 'granted') {
          const webOptions: NotificationOptions = {
            body: options?.message ?? options?.body,
            icon: options?.iconUrl ?? options?.icon,
            tag: options?.tag,
            data: options?.data,
            requireInteraction: options?.requireInteraction,
          };
          const instance = new Notification(options?.title ?? 'PoeLink', webOptions);
          instance.onerror = (event) => logComm.warn('[Notify] web notification error', event);
          instance.onshow = () => logComm.debug('[Notify] web notification shown');
          instance.onclick = () => logComm.debug('[Notify] web notification clicked');
          instance.onclose = () => logComm.debug('[Notify] web notification closed');
          return;
        }
      }
      if (notificationsApi?.create) {
        logComm.debug('[Notify] fallback to browser.notifications');
        await notificationsApi.create('', options);
        logComm.debug('[Notify] browser.notifications created');
        return;
      }
      logComm.info('[Notify] Notifications API unavailable, fallback to background');
    } catch (error) {
      logComm.warn('通知创建失败，回退到后台', error);
    }
    await this.sendMessageToBackground({
      type: 'notify',
      options: options
    });
  }

  /**
   * 切换悬浮窗显示状态
   * 发送消息给后台，后台再通知当前标签页
   */
  async toggleFloatingWindow(): Promise<void> {
    try {
      await this.sendMessageToBackground({ type: 'TOGGLE_FLOATING_BG' });
    } catch (error) {
      logComm.error('切换悬浮窗请求失败', error);
    }
  }
}

const communicationService = new CommunicationService();
export default communicationService;
