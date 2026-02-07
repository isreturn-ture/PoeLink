import { buildBaseUrl, getBackendServerConfig, normalizeServerConfig } from '../utils/config';

/** 扩展 RequestInit，支持超时（毫秒） */
export interface RequestOptionsWithTimeout extends RequestInit {
  timeoutMs?: number;
}

const DEFAULT_PROXY_TIMEOUT_MS = 15000;
const DEFAULT_EXTERNAL_TIMEOUT_MS = 20000;
const MIN_TIMEOUT_MS = 1000;

function createAbortControllerWithTimeout(
  timeoutMs: number,
  upstreamSignal?: AbortSignal | null
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(MIN_TIMEOUT_MS, timeoutMs));
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

async function getErrorMessageFromResponse(response: Response): Promise<string> {
  let errorMsg = response.statusText;
  try {
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const errorBody = await response.json();
      const candidate = (errorBody && (errorBody.message ?? errorBody.error ?? errorBody.msg)) as unknown;
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
      return JSON.stringify(errorBody).slice(0, 300);
    }
    const errorText = await response.text();
    return errorText?.trim() ? errorText.slice(0, 300) : errorMsg;
  } catch {
    return errorMsg;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return await response.json();
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { result: text };
  }
}

export async function handleProxyRequest(endpoint: string, options: RequestOptionsWithTimeout = {}) {
  const server = normalizeServerConfig(await getBackendServerConfig());
  if (!server) throw new Error('未配置服务器信息');

  const url = `${buildBaseUrl(server)}${endpoint}`;
  const headers = { ...options.headers } as Record<string, string>;
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const timeoutMs =
    typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_PROXY_TIMEOUT_MS;
  const { controller, cleanup } = createAbortControllerWithTimeout(timeoutMs, options.signal);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: (options.credentials as RequestCredentials) ?? 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorMsg = await getErrorMessageFromResponse(response);
      throw new Error(`API请求失败: ${response.status} ${errorMsg}`);
    }
    return await parseResponseBody(response);
  } catch (err) {
    if (controller.signal.aborted) throw new Error('请求超时');
    throw err;
  } finally {
    cleanup();
  }
}

export async function handleExternalRequest(url: string, options: RequestOptionsWithTimeout = {}) {
  if (!url || typeof url !== 'string') throw new Error('缺少请求地址');
  if (!/^https?:\/\//i.test(url)) throw new Error('非法请求地址');

  const headers = { ...options.headers } as Record<string, string>;
  if (!headers['Accept']) headers['Accept'] = 'application/json';

  const timeoutMs =
    typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_EXTERNAL_TIMEOUT_MS;
  const { controller, cleanup } = createAbortControllerWithTimeout(timeoutMs, options.signal);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorMsg = await getErrorMessageFromResponse(response);
      throw new Error(`API请求失败: ${response.status} ${errorMsg}`);
    }
    return await parseResponseBody(response);
  } catch (err) {
    if (controller.signal.aborted) throw new Error('请求超时');
    throw err;
  } finally {
    cleanup();
  }
}
