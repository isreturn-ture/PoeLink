import { buildBaseUrl, buildServerIdentifier, getBackendServerConfig, getPoeLinkConfig, normalizeServerConfig } from '../utils/config';
import type { LoggerLike } from '../sharedTypes';

export async function handleCookieSync(data: any) {
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

export async function handleGetCookies(server: any) {
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

export async function runCookieSyncTask(force: boolean, logBg?: LoggerLike) {
  try {
    const cfg = await getPoeLinkConfig(logBg);
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
      logBg?.info?.('自动同步 Cookie 成功', { count: filteredCookies.length });
    }
  } catch (error) {
    logBg?.debug?.('自动同步 Cookie 跳过或失败', error);
  }
}
