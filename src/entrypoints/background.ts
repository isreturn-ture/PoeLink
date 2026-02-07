import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { createLogger } from '../utils/logger';
import type { Message } from './background/types';
import { handleMessage } from './background/messageRouter';
import { runCookieSyncTask } from './background/handlers/cookies';
import {
  startBackendStatusMonitor,
  stopBackendStatusMonitor,
} from './background/handlers/backendStatusMonitor';
import { getBackendServerConfig } from './background/utils/config';

const logBg = createLogger('background');

async function syncStatusMonitor() {
  const server = await getBackendServerConfig();
  const hasServer = !!(server?.host?.trim() && server?.port);
  if (hasServer) {
    startBackendStatusMonitor();
  } else {
    stopBackendStatusMonitor();
  }
}

export default defineBackground({
  main() {
    // 根据配置启动/停止后端状态监控（配置现从 SQLite 读取）
    syncStatusMonitor();

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
          return await handleMessage(request, sender, logBg);
        } catch (error: any) {
          logBg.error(`处理消息 ${request.type} 失败`, error);
          return { success: false, error: error.message };
        }
      };

      handleAsync().then(sendResponse);
      return true; // 保持消息通道开放
    });

    // 定时同步Cookie任务 - 每30秒执行一次
    setInterval(() => runCookieSyncTask(false, logBg), 30000);

    logBg.info('后台服务工作线程已启动');
  }
});

