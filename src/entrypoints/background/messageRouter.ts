import type { Message } from './types';
import type { LoggerLike } from './sharedTypes';
import { handleProxyRequest, handleExternalRequest } from './handlers/requests';
import { handleCookieSync, handleGetCookies, runCookieSyncTask } from './handlers/cookies';
import { handleHealthCheck, handleConfigValidation, handleLogDownload } from './handlers/system';

export async function handleMessage(request: Message, _sender: any, logBg: LoggerLike) {
  switch (request.type) {
    case 'notify': {
      const notifyOptions = {
        type: 'basic',
        title: 'PoeLink',
        message: '',
        iconUrl: 'chrome://favicon/size/64@1x/chrome://extensions',
        ...(request.options ?? {})
      };
      logBg.debug?.('[Notify] request', notifyOptions);
      await browser.notifications.create('', notifyOptions);
      logBg.debug?.('[Notify] created');
      return { success: true };
    }

    case 'OPEN_NOTIFICATION_SETTINGS':
      await browser.tabs.create({ url: 'chrome://settings/content/notifications' });
      return { success: true };

    case 'TOGGLE_FLOATING_BG': {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        await browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_FLOATING' });
        return { success: true };
      }
      return { success: false, error: '无活动标签页' };
    }

    case 'PROXY_REQUEST':
      return await handleProxyRequest(request.endpoint, request.options);

    case 'EXTERNAL_REQUEST':
      return await handleExternalRequest(request.url, request.options);

    case 'SYNC_COOKIES':
      return await handleCookieSync(request.data);

    case 'TRIGGER_COOKIE_SYNC':
      await runCookieSyncTask(true, logBg);
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
}
