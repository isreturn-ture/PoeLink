import { defineBackground } from 'wxt/utils/define-background';

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
}

export default defineBackground({
  main() {
    // 监听扩展图标点击事件
    browser.action.onClicked.addListener((tab) => {
      if (tab.id) {
        console.log('扩展图标被点击，向内容脚本发送消息');
        browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_FLOATING' });
      }
    });

    // 监听来自内容脚本/Popup的消息
    browser.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
      // console.log('收到消息:', request.type);

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
              console.log('[Notify][BG] request', notifyOptions);
              await browser.notifications.create('', notifyOptions);
              console.log('[Notify][BG] created');
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

            case 'SYNC_COOKIES':
              return await handleCookieSync(request.data);

            case 'TRIGGER_COOKIE_SYNC':
              await runCookieSyncTask();
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
          console.error(`处理消息 ${request.type} 失败:`, error);
          return { success: false, error: error.message };
        }
      };

      handleAsync().then(sendResponse);
      return true; // 保持消息通道开放
    });

    // 定时同步Cookie任务 - 每30秒执行一次
    setInterval(runCookieSyncTask, 30000);

    console.log('后台服务工作线程已启动');
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

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    // 尝试读取错误信息
    let errorMsg = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody && errorBody.message) errorMsg = errorBody.message;
    } catch {}
    throw new Error(`API请求失败: ${response.status} ${errorMsg}`);
  }

  // 尝试解析 JSON，如果失败则返回文本
  const text = await response.text();
  try {
    return JSON.parse(text); // 直接返回数据，不包装在 success 中，由调用方处理
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

async function runCookieSyncTask() {
  try {
    const cfg = await getPoeLinkConfig();
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
      console.log('自动同步 Cookie 成功');
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
    console.error('获取服务器配置失败:', error);
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
