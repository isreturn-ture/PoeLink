import { arrayBufferToBase64 } from '../utils/encoding';
import { buildBaseUrl, getBackendServerConfig, normalizeServerConfig } from '../utils/config';

export async function handleHealthCheck(server: any) {
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
