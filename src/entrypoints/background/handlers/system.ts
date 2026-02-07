import { arrayBufferToBase64 } from '../utils/encoding';
import { buildBaseUrl, buildWsUrl, getBackendServerConfig, normalizeServerConfig } from '../utils/config';

/** WebSocket 服务状态接口：发送 service_status 消息并等待响应 */
export async function handleHealthCheck(server: any): Promise<{ success: boolean; error?: string; data?: any }> {
  const normalized = normalizeServerConfig(server);
  if (!normalized) throw new Error('缺少服务器信息');

  const wsUrl = buildWsUrl(normalized);
  const requestId = `health-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const overallTimeoutMs = 10000; // WS 连接 + 响应总超时
    let timeoutId: ReturnType<typeof setTimeout>;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof ws !== 'undefined' && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };

    const finish = (result: { success: boolean; error?: string; data?: any }) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    const fail = (err: Error) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(err);
    };

    timeoutId = setTimeout(() => {
      fail(new Error('WebSocket 连接或响应超时'));
    }, overallTimeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      fail(err instanceof Error ? err : new Error('WebSocket 创建失败'));
      return;
    }

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'service_status',
          requestId,
          timeoutMs: 3000,
          concurrency: 4,
          maxRoutes: 200,
          force: true,
        })
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'service_status' && msg.requestId === requestId) {
          const success = msg.success === true;
          const overall = msg.data?.overall;
          const healthy = overall === 'healthy' || overall === 'degraded';
          if (success && healthy) {
            finish({ success: true, data: msg.data });
          } else {
            const errMsg =
              overall === 'unhealthy'
                ? `服务状态: ${overall} (ok: ${msg.data?.okCount ?? 0}/${msg.data?.total ?? 0})`
                : msg.error || `服务状态: ${overall || 'unknown'}`;
            finish({ success: false, error: errMsg, data: msg.data });
          }
        }
      } catch {
        // 忽略非 JSON 或不匹配的消息
      }
    };

    ws.onerror = () => {
      fail(new Error('WebSocket 连接失败'));
    };

    ws.onclose = () => {
      if (!resolved) {
        fail(new Error('WebSocket 连接已关闭'));
      }
    };
  });
}

export async function handleConfigValidation(config: any) {
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

export async function handleLogDownload(filename: string) {
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
