import { defineBackground } from 'wxt/utils/define-background';
import { createLogger } from '../utils/logger';

const logBg = createLogger('background');

interface Message {
  type: string;
  [key: string]: any;
}

interface ServerConfig {
  host: string;
  port: number | string;
  protocol: string;
  ip?: string;
}

interface PoeLinkConfig {
  server: ServerConfig;
  database?: any;
  ops?: any;
  app?: {
    autoSyncCookies?: boolean;
  };
}

export default defineBackground({
  main() {
    // 监听扩展图标点击事件
    browser.action.onClicked.addListener((tab) => {
      if (tab.id) {
        logBg.info('扩展图标被点击，向内容脚本发送消息', { tabId: tab.id });
        browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_FLOATING' });
      }
    });

    // 监听来自内容脚本/Popup的消息
    browser.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
      logBg.debug('收到消息', { type: request.type, fromTabId: sender.tab?.id, request });

      const handleAsync = async () => {
        try {
          switch (request.type) {
            case 'notify':
              const notifyOptions = {
                type: 'basic',
                title: 'PoeLink',
                message: '',
                iconUrl: 'chrome://favicon/size/64@1x/chrome://extensions',
                ...(request.options ?? {})
              };
              logBg.debug('[Notify] request', notifyOptions);
              await browser.notifications.create('', notifyOptions);
              logBg.debug('[Notify] created');
              return { success: true };

            case 'OPEN_NOTIFICATION_SETTINGS':
              await browser.tabs.create({ url: 'chrome://settings/content/notifications' });
              return { success: true };

            case 'TOGGLE_FLOATING_BG':
              const tabs = await browser.tabs.query({ active: true, currentWindow: true });
              if (tabs.length > 0 && tabs[0].id) {
                await browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_FLOATING' });
                return { success: true };
              }
              return { success: false, error: '无活动标签页' };

            case 'PROXY_REQUEST':
              return await handleProxyRequest(request.endpoint, request.options);

            case 'EXTERNAL_REQUEST':
              return await handleExternalRequest(request.url, request.options);

            case 'SYNC_COOKIES':
              return await handleCookieSync(request.data);

            case 'TRIGGER_COOKIE_SYNC':
              await runCookieSyncTask(true);
              return { success: true };

            case 'GET_COOKIES':
              return await handleGetCookies(request.server);

            case 'HEALTH_CHECK':
              return await handleHealthCheck(request.server);

            case 'VALIDATE_CONFIG':
              return await handleConfigValidation(request.config);

            case 'DOWNLOAD_LOG':
              return await handleLogDownload(request.filename);

            default:
              return { success: false, error: '未知消息类型' };
          }
        } catch (error: any) {
          logBg.error(`处理消息 ${request.type} 失败`, error);
          return { success: false, error: error.message };
        }
      };

      handleAsync().then(sendResponse);
      return true; // 保持消息通道开放
    });

    // 定时同步Cookie任务 - 每30秒执行一次
    setInterval(() => runCookieSyncTask(false), 30000);

    logBg.info('后台服务工作线程已启动');
  }
});

// ================== 处理函数 ==================

async function handleProxyRequest(endpoint: string, options: RequestInit = {}) {
  const server = normalizeServerConfig(await getBackendServerConfig());
  if (!server) {
    throw new Error('未配置服务器信息');
  }

  const baseUrl = buildBaseUrl(server);
  const url = `${baseUrl}${endpoint}`;
  
  // 确保 Content-Type
  const headers = { ...options.headers } as Record<string, string>;
  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutMs = typeof (options as any)?.timeoutMs === 'number' ? Number((options as any).timeoutMs) : 15000;
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  const upstreamSignal = options.signal;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: (options.credentials as RequestCredentials) ?? 'include',
      signal: controller.signal,
    });
  } catch (err: any) {
    if (controller.signal.aborted) {
      throw new Error('请求超时');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const errorBody = await response.json();
        const candidate = (errorBody && (errorBody.message || errorBody.error || errorBody.msg)) as unknown;
        if (typeof candidate === 'string' && candidate.trim()) errorMsg = candidate;
        else errorMsg = JSON.stringify(errorBody).slice(0, 300);
      } else {
        const errorText = await response.text();
        if (errorText?.trim()) errorMsg = errorText.slice(0, 300);
      }
    } catch {}
    throw new Error(`API请求失败: ${response.status} ${errorMsg}`);
  }

  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { result: text };
  }
}

async function handleExternalRequest(url: string, options: RequestInit = {}) {
  if (!url || typeof url !== 'string') throw new Error('缺少请求地址');
  if (!/^https?:\/\//i.test(url)) throw new Error('非法请求地址');

  const headers = { ...options.headers } as Record<string, string>;
  if (!headers['Accept']) headers['Accept'] = 'application/json';

  const controller = new AbortController();
  const timeoutMs = typeof (options as any)?.timeoutMs === 'number' ? Number((options as any).timeoutMs) : 20000;
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  const upstreamSignal = options.signal;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (controller.signal.aborted) throw new Error('请求超时');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const errorBody = await response.json();
        const candidate = (errorBody && (errorBody.message || errorBody.error || errorBody.msg)) as unknown;
        if (typeof candidate === 'string' && candidate.trim()) errorMsg = candidate;
        else errorMsg = JSON.stringify(errorBody).slice(0, 300);
      } else {
        const errorText = await response.text();
        if (errorText?.trim()) errorMsg = errorText.slice(0, 300);
      }
    } catch {}
    throw new Error(`API请求失败: ${response.status} ${errorMsg}`);
  }

  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { result: text };
  }
}

async function handleCookieSync(data: any) {
  const backend = normalizeServerConfig(await getBackendServerConfig());
  if (!backend) throw new Error('未配置服务器信息');

  const { server, cookies } = data;
  const serverUrl = buildBaseUrl(backend);
  
  const response = await fetch(`${serverUrl}/api/cookies/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ server, cookies })
  });
  
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return { success: true, data: await response.json() };
}

async function handleGetCookies(server: any) {
  const backend = normalizeServerConfig(await getBackendServerConfig());
  if (!backend) throw new Error('未配置服务器信息');
  if (!server) throw new Error('缺少服务器信息');

  const serverIdentifier = buildServerIdentifier(server);
  const serverUrl = buildBaseUrl(backend);
  
  const response = await fetch(`${serverUrl}/api/cookies/get?server=${encodeURIComponent(serverIdentifier)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return { success: true, data: await response.json() };
}

async function handleHealthCheck(server: any) {
  const normalized = normalizeServerConfig(server);
  if (!normalized) throw new Error('缺少服务器信息');

  const serverUrl = buildBaseUrl(normalized);
  let response = await fetch(`${serverUrl}/api/health`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (response.status === 404) {
    response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return { success: true, data: await response.json() };
}

async function handleConfigValidation(config: any) {
  if (!config || !config.server) throw new Error('缺少服务器配置信息');

  const normalized = normalizeServerConfig(config.server);
  if (!normalized) throw new Error('缺少服务器配置信息');
  const serverUrl = buildBaseUrl(normalized);
  const response = await fetch(`${serverUrl}/api/config/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return { success: true, data: await response.json() };
}

async function handleLogDownload(filename: string) {
  const server = normalizeServerConfig(await getBackendServerConfig());
  if (!server) throw new Error('未配置服务器信息');

  const serverUrl = buildBaseUrl(server);
  const response = await fetch(`${serverUrl}/api/logs/download?filename=${encodeURIComponent(filename)}`, {
    method: 'GET'
  });
  
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  
  return { 
    success: true, 
    data: { 
      content: base64,
      type: blob.type,
      size: blob.size
    } 
  };
}

async function runCookieSyncTask(force: boolean) {
  try {
    const cfg = await getPoeLinkConfig();
    if (!force && cfg?.app && cfg.app.autoSyncCookies === false) return;
    const backend = cfg?.server;
    const ops = cfg?.ops;
    if (!backend || !ops?.ip) return;

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeUrl = tabs.length > 0 && tabs[0].url ? tabs[0].url : '';
    const activeCookies = activeUrl ? await browser.cookies.getAll({ url: activeUrl }) : [];
    const opsDomain = ops.ip;
    const opsCookies = await browser.cookies.getAll({ domain: opsDomain });

    const merged = [...activeCookies, ...opsCookies];
    const requiredNames = new Set(['JSESSIONID', 'accessToken', 'opsAccessToken']);
    const filteredCookies = merged.filter(cookie => {
      const name = cookie?.name || '';
      const domain = String(cookie?.domain || '').replace(/^\./, '');
      return requiredNames.has(name) && (domain === opsDomain || opsDomain.endsWith(domain) || domain.endsWith(opsDomain));
    });

    if (filteredCookies.length > 0) {
      const standardCookies = filteredCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
      }));

      await handleCookieSync({
        server: {
          host: ops.ip,
          port: ops.port,
          protocol: (ops.protocol || 'https').toLowerCase()
        },
        cookies: standardCookies
      });
      logBg.info('自动同步 Cookie 成功', { count: filteredCookies.length });
    }
  } catch (error) {
    // 忽略静默失败，避免刷屏
    // console.error('自动同步失败:', error);
  }
}

// ================== 辅助函数 ==================

async function getPoeLinkConfig() {
  try {
    const result = await browser.storage.local.get(['poelink_config']);
    const config = result.poelink_config as PoeLinkConfig | undefined;
    return config || null;
  } catch (error) {
    logBg.error('获取服务器配置失败', error);
    return null;
  }
}

async function getBackendServerConfig() {
  const cfg = await getPoeLinkConfig();
  return cfg?.server || null;
}

function normalizeServerConfig(server: any): ServerConfig | null {
  if (!server) return null;

  let protocol = String(server.protocol || 'http').toLowerCase();
  let host = server.host || server.ip || '';
  let port = server.port ?? '';

  if (typeof host === 'string' && (host.startsWith('http://') || host.startsWith('https://'))) {
    try {
      const url = new URL(host);
      protocol = url.protocol.replace(':', '') || protocol;
      host = url.hostname || host;
      if (!port && url.port) port = url.port;
    } catch {
      // ignore invalid URL and fall back to raw host
    }
  } else if (typeof host === 'string' && host.includes('/') && !host.includes('://')) {
    try {
      const url = new URL(`${protocol}://${host}`);
      host = url.hostname || host;
      if (!port && url.port) port = url.port;
    } catch {
      // ignore invalid URL and fall back to raw host
    }
  }

  if (typeof host === 'string' && host.includes(':') && !port) {
    const [hostname, maybePort] = host.split(':');
    if (hostname && maybePort) {
      host = hostname;
      port = maybePort;
    }
  }

  return {
    ...server,
    protocol,
    host,
    port
  };
}

function buildBaseUrl(server: ServerConfig) {
  const protocol = String(server.protocol || 'http').toLowerCase();
  const host = server.host || server.ip || '';
  const port = server.port ? `:${server.port}` : '';
  return `${protocol}://${host}${port}`;
}

function buildServerIdentifier(server: any) {
  const normalized = normalizeServerConfig(server);
  if (!normalized) return '';
  const protocol = String(normalized.protocol || 'http').toLowerCase();
  const host = normalized.host || normalized.ip;
  const port = normalized.port;
  if (protocol && host && port) return `${protocol}://${host}:${port}`;
  if (protocol && host) return `${protocol}://${host}`;
  return String(host || '');
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
