import type { PoeLinkConfig, ServerConfig } from '../types';
import type { LoggerLike } from '../sharedTypes';

export async function getPoeLinkConfig(logBg?: LoggerLike) {
  try {
    const result = await browser.storage.local.get(['poelink_config']);
    const config = result.poelink_config as PoeLinkConfig | undefined;
    return config || null;
  } catch (error) {
    logBg?.error?.('获取服务器配置失败', error);
    return null;
  }
}

export async function getBackendServerConfig(logBg?: LoggerLike) {
  const cfg = await getPoeLinkConfig(logBg);
  return cfg?.server || null;
}

export function normalizeServerConfig(server: any): ServerConfig | null {
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

export function buildBaseUrl(server: ServerConfig) {
  const protocol = String(server.protocol || 'http').toLowerCase();
  const host = server.host || server.ip || '';
  const port = server.port ? `:${server.port}` : '';
  return `${protocol}://${host}${port}`;
}

export function buildServerIdentifier(server: any) {
  const normalized = normalizeServerConfig(server);
  if (!normalized) return '';
  const protocol = String(normalized.protocol || 'http').toLowerCase();
  const host = normalized.host || normalized.ip;
  const port = normalized.port;
  if (protocol && host && port) return `${protocol}://${host}:${port}`;
  if (protocol && host) return `${protocol}://${host}`;
  return String(host || '');
}
