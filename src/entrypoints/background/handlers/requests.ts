import { buildBaseUrl, getBackendServerConfig, normalizeServerConfig } from '../utils/config';

export async function handleProxyRequest(endpoint: string, options: RequestInit = {}) {
  const server = normalizeServerConfig(await getBackendServerConfig());
  if (!server) {
    throw new Error('未配置服务器信息');
  }

  const baseUrl = buildBaseUrl(server);
  const url = `${baseUrl}${endpoint}`;

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

export async function handleExternalRequest(url: string, options: RequestInit = {}) {
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
