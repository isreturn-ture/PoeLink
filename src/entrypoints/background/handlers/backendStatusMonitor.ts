/**
 * 后端状态监控：单一持久 WebSocket 连接，订阅-推送模式
 * - 建立一次连接，发送 subscribe 一次，后端每 1 秒主动推送状态（缓存期内返回 cached=true）
 * - 保留 service_status 单次请求能力（用于配置页手动刷新，force=true 强制探测）
 */

import { getBackendServerConfig, buildWsUrl, normalizeServerConfig } from '../utils/config';
import { handleHealthCheck } from './system';
import { dbGetBackendStatus, dbSetBackendStatus } from '../db/sqlite';
const RECONNECT_DELAY_MS = 3000;
const RECONNECT_MAX_DELAY_MS = 30_000;
/** 超过此时间未收到任何 service_status 推送则视为离线（后端约定约 1 秒推送一次） */
const PUSH_TIMEOUT_MS = 5_000;

export interface BackendStatus {
  online: boolean;
  lastCheck: number;
  checking?: boolean;
  error?: string;
}

let ws: WebSocket | null = null;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let pushTimeoutId: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let currentServerUrl = '';

async function writeStatus(status: Partial<BackendStatus>) {
  try {
    const existing = await dbGetBackendStatus();
    const now = Date.now();
    await dbSetBackendStatus({
      online: false,
      ...existing,
      ...status,
      lastCheck: status.lastCheck ?? existing?.lastCheck ?? now,
    });
  } catch {
    // ignore
  }
}

function parseStatusFromMessage(msg: any): { online: boolean; error?: string } | null {
  if (!msg || msg.type !== 'service_status') return null;
  const success = msg.success === true;
  const overall = msg.data?.overall;
  const healthy = overall === 'healthy' || overall === 'degraded';
  if (success && healthy) {
    return { online: true };
  }
  const errMsg =
    overall === 'unhealthy'
      ? `服务状态: ${overall} (ok: ${msg.data?.okCount ?? 0}/${msg.data?.total ?? 0})`
      : msg.error || `服务状态: ${overall || 'unknown'}`;
  return { online: false, error: errMsg };
}

function connect() {
  getBackendServerConfig().then(async (server) => {
    if (!server?.host?.trim() || !server?.port) {
      await writeStatus({ online: false, lastCheck: Date.now(), checking: false });
      return;
    }

    const normalized = normalizeServerConfig(server);
    if (!normalized) {
      await writeStatus({ online: false, lastCheck: Date.now(), checking: false });
      return;
    }

    const wsUrl = buildWsUrl(normalized);
    if (wsUrl === currentServerUrl && ws?.readyState === WebSocket.OPEN) return;

    disconnect();
    currentServerUrl = wsUrl;

    await writeStatus({ checking: true });

    try {
      const socket = new WebSocket(wsUrl);
      ws = socket;

      function clearPushTimeout() {
        if (pushTimeoutId) {
          clearTimeout(pushTimeoutId);
          pushTimeoutId = null;
        }
      }

      function schedulePushTimeout() {
        clearPushTimeout();
        pushTimeoutId = setTimeout(() => {
          pushTimeoutId = null;
          writeStatus({ online: false, lastCheck: Date.now(), checking: false, error: '未收到状态推送' });
          if (ws) {
            ws.close();
          }
        }, PUSH_TIMEOUT_MS);
      }

      socket.onopen = () => {
        reconnectAttempts = 0;
        socket.send(
          JSON.stringify({
            type: 'subscribe',
            dataType: 'service_status',
            filter: {},
          })
        );
        // 不在此处设为在线，等收到推送后再设；并启动「超时未收到推送」检测
        schedulePushTimeout();
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data));
          const parsed = parseStatusFromMessage(msg);
          if (parsed) {
            clearPushTimeout();
            writeStatus({
              online: parsed.online,
              lastCheck: Date.now(),
              checking: false,
              error: parsed.error,
            });
            if (ws?.readyState === WebSocket.OPEN) {
              schedulePushTimeout();
            }
          }
        } catch {
          // 忽略非 JSON 或无法解析的消息
        }
      };

      socket.onerror = () => {
        clearPushTimeout();
        writeStatus({ online: false, lastCheck: Date.now(), checking: false, error: 'WebSocket 连接错误' });
      };

      socket.onclose = () => {
        clearPushTimeout();
        ws = null;
        writeStatus({ online: false, lastCheck: Date.now(), checking: false, error: '连接已关闭' });
        scheduleReconnect();
      };
    } catch (err) {
      ws = null;
      writeStatus({
        online: false,
        lastCheck: Date.now(),
        checking: false,
        error: err instanceof Error ? err.message : '连接失败',
      });
      scheduleReconnect();
    }
  });
}

function scheduleReconnect() {
  if (reconnectTimeoutId) return;
  const delay = Math.min(
    RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_DELAY_MS
  );
  reconnectAttempts += 1;
  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    connect();
  }, delay);
}

function disconnect() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  if (pushTimeoutId) {
    clearTimeout(pushTimeoutId);
    pushTimeoutId = null;
  }
  reconnectAttempts = 0;
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'unsubscribe',
          dataType: 'service_status',
          filter: {},
        })
      );
    }
    ws.close();
    ws = null;
  }
  currentServerUrl = '';
}

/** 立即标记为离线（如 API 请求失败时调用） */
export async function markBackendOffline(): Promise<void> {
  await writeStatus({ online: false, lastCheck: Date.now(), checking: false, error: '连接已断开' });
}

/** 启动监控：建立单一持久 WebSocket，订阅后端推送 */
export function startBackendStatusMonitor(): void {
  connect();
}

/** 停止监控：关闭 WebSocket，停止重连 */
export function stopBackendStatusMonitor(): void {
  disconnect();
}

/** 获取当前状态 */
export async function getBackendStatus(): Promise<BackendStatus | null> {
  return await dbGetBackendStatus();
}

/** 触发一次即时检测（兼容手动刷新，使用 service_status 单次请求） */
export async function triggerImmediateCheck(): Promise<BackendStatus | null> {
  const server = await getBackendServerConfig();
  if (!server?.host?.trim() || !server?.port) {
    return getBackendStatus();
  }
  await writeStatus({ checking: true });
  try {
    const result = await handleHealthCheck(server);
    await writeStatus({
      online: result.success,
      lastCheck: Date.now(),
      checking: false,
      error: result.error,
    });
  } catch (err: unknown) {
    await writeStatus({
      online: false,
      lastCheck: Date.now(),
      checking: false,
      error: err instanceof Error ? err.message : '连接失败',
    });
  }
  return getBackendStatus();
}
