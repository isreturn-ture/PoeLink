import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { browser } from 'wxt/browser';
import communicationService from './services/CommunicationService';
import { analyzeInputOnce, recognizeIntent } from './services/IntentService';
import { extractEntities } from './services/EntityService';
import { createLogger } from '../../utils/logger';
import { useThemeSetting } from '../../hooks/useThemeSetting';
import { useHistoryPanel } from '../../hooks/useHistoryPanel';
import { useChatSessions } from '../../hooks/useChatSessions';
import { usePopupSizing } from '../../hooks/usePopupSizing';
import { useConfigState } from '../../hooks/useConfigState';
import { createAppI18n } from '../../i18n';
import type { AppI18nKey } from '../../i18n';

import WelcomeView from './views/WelcomeView';
import ConfigView from './views/ConfigView';
import ChatView from './views/ChatView';

import { type AppProps, type AppSettings, type ComponentVersions, type Message, type TimelineItem } from './types';

const log = createLogger('popup');

const STREAM_CHUNK_SIZE = 3;
const getStreamIntervalMs = (speed: AppSettings['streamSpeed'] | undefined) => {
  if (speed === 'fast') return 10;
  if (speed === 'slow') return 40;
  return 20;
};

const getFriendlyErrorMessage = (err: unknown, t: (k: AppI18nKey) => string) => {
  if (typeof err === 'string') return t('serviceUnavailable');
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = String((err as { message?: string }).message ?? '');
    if (raw.toLowerCase().includes('network')) return t('networkError');
    if (raw.toLowerCase().includes('fetch')) return t('serviceUnavailable');
  }
  return t('serviceUnavailable');
};

const MainApp: React.FC<AppProps> = ({ onClose, showCloseInHeader = true }) => {
  const [view, setView] = useState<'welcome' | 'chat' | 'config'>('welcome');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [componentVersions, setComponentVersions] = useState<ComponentVersions>({});
  const [versionLoading, setVersionLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [activeConfigTab, setActiveConfigTab] = useState<'service' | 'llm' | 'app'>('service');
  const [saveNotice, setSaveNotice] = useState('');
  const [configEntry, setConfigEntry] = useState<'welcome' | 'chat'>('welcome');

  const [serverTestStatus, setServerTestStatus] = useState('');
  const [dbTestStatus, setDbTestStatus] = useState('');
  const [opsTestStatus, setOpsTestStatus] = useState('');
  /** 后端在线状态：true=在线, false=离线, null=检测中/未知 */
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const { historyOpen, historyMounted, openHistory, closeHistory } = useHistoryPanel(220);
  const {
    messages,
    setMessages,
    sessions,
    activeSessionId,
    saveMessages,
    clearChatHistory,
    createNewSession,
    switchSession,
  } = useChatSessions({ closeHistory, log });

  const {
    config,
    isConfigured,
    isConfigSaved,
    hasServerConfig,
    isStepComplete,
    updateConfig,
    updateLlmConfig,
    saveConfig,
  } = useConfigState({
    onConfigured: useCallback(() => setView('chat'), []),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lang = config.app?.language ?? 'zh-CN';
  const { t } = useMemo(() => createAppI18n(lang), [lang]);
  const steps = useMemo(
    () => [t('stepServer'), t('stepDatabase'), t('stepOps')],
    [t]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useThemeSetting(config.app?.theme);
  usePopupSizing({ view });

  // 后端状态：进入聊天页时获取，并订阅 storage 实时更新
  useEffect(() => {
    if (!hasServerConfig()) {
      setBackendOnline(null);
      return;
    }
    const fetchStatus = async (immediate = false) => {
      try {
        const status = await communicationService.getBackendStatus(immediate);
        setBackendOnline(status?.online ?? null);
      } catch {
        setBackendOnline(false);
      }
    };
    // 进入聊天页时触发即时检测
    fetchStatus(view === 'chat');
    const handler = (changes: Record<string, browser.Storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local' || !changes.poelink_backend_status) return;
      const next = changes.poelink_backend_status.newValue as { online?: boolean } | undefined;
      setBackendOnline(next?.online ?? null);
    };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, [hasServerConfig, config.server?.host, config.server?.port, view]);

  const notifyUser = useCallback((message: string, _type: 'success' | 'error' | 'info' = 'info') => {
    const iconUrl = typeof browser?.runtime?.getURL === 'function'
      ? browser.runtime.getURL('icon/icons8-bot-32.png')
      : undefined;
    communicationService.sendNotification({
      type: 'basic',
      title: 'PoeLink',
      message,
      iconUrl,
    });
  }, []);

  const handleSend = useCallback(async () => {
    const isChitChatInput = (text: string): boolean => {
      const s = String(text || '').trim();
      if (!s) return false;
      const lower = s.toLowerCase();

      const hasOpsSignal = /(t\d{6,}|return\d{6,}|\d{3,6}|任务|状态|日志|故障|异常|错误|告警|报警|下载|检索|查询|健康|检查|cpu|内存|超时|失败|rcs|wcs|agv|amr|iwms)/i.test(lower);
      if (hasOpsSignal) return false;

      return /^(?:你好|您好|哈喽|嗨|hi|hello|hey|在吗|在么|你是谁|你叫什么|谢谢|谢了)[\s!！?？。,.，]*$/i.test(lower);
    };

    if (!inputValue.trim() || isLoading) return;
    if (!hasServerConfig()) {
      const tipMsg: Message = {
        role: 'assistant',
        content: t('configRequired'),
      };
      setMessages([...messages, tipMsg]);
      saveMessages([...messages, tipMsg]);
      setView('config');
      return;
    }
    if (backendOnline === false) return;

    const userMsg: Message = { role: 'user', content: inputValue.trim() };
    const optimisticMsgs = [...messages, userMsg];

    setMessages(optimisticMsgs);
    saveMessages(optimisticMsgs);
    setInputValue('');
    setIsLoading(true);

    try {
      const llmConfig = config.llm?.apiKey ? config.llm : null;
      let intentResult: any;
      let entities: any;
      let assistantReply: string | null | undefined;

      if (llmConfig?.apiKey) {
        try {
          const combined = await analyzeInputOnce(userMsg.content, llmConfig);
          intentResult = combined.intentResult;
          entities = combined.entities;
          assistantReply = combined.assistantReply;
        } catch {
          intentResult = await recognizeIntent(userMsg.content, null);
          entities = await extractEntities(userMsg.content, null);
        }
      } else {
        [intentResult, entities] = await Promise.all([
          recognizeIntent(userMsg.content, null),
          extractEntities(userMsg.content, null)
        ]);
      }

      const forceChitChat = isChitChatInput(userMsg.content);
      if (forceChitChat) {
        const fallback = t('helloFallback');
        const normalizedReply = (assistantReply && String(assistantReply).trim()) || fallback;
        assistantReply = normalizedReply;
        intentResult = {
          ...(intentResult || {}),
          intent: 'unknown',
          confidence: Math.min(Number(intentResult?.confidence ?? 0), 0.2),
          description: '闲聊/问候'
        };
      }

      if (intentResult?.intent === 'unknown' && assistantReply) {
        const aiMsg: Message = {
          role: 'assistant',
          content: String(assistantReply).trim() || t('helloDefault')
        };
        const nextMsgs = [...optimisticMsgs, aiMsg];
        setMessages(nextMsgs);
        saveMessages(nextMsgs);
        setIsLoading(false);
        return;
      }

      const loweredInput = userMsg.content.toLowerCase();
      const wantsLogs = loweredInput.includes('日志') || loweredInput.includes('log') || loweredInput.includes('下载');
      if (entities?.task && !wantsLogs && intentResult.intent !== 'query_status') {
        intentResult = {
          ...intentResult,
          intent: 'query_status',
          confidence: Math.max(intentResult.confidence || 0, 0.6),
          description: '任务状态查询',
        };
      }

      const res = await communicationService.callApiJson('/api/chat', {
        method: 'POST',
        body: {
          input: userMsg.content,
          configId: config.configId,
          description: intentResult?.description,
          intentResult,
          entities
        },
        timeoutMs: 60000,
      });

      let content = typeof res === 'string'
        ? res
        : (res.result ?? res.message ?? t('serviceUnavailable'));

      let downloadUrl: string | undefined;
      let downloadLabel: string | undefined;
      let timeline: TimelineItem[] | undefined;
      let rawThirdMsg: unknown;
      if (res && typeof res === 'object') {
        const logFile = (res as any).data?.log_file ?? (res as any).data?.result?.log_file ?? (res as any).data?.data?.log_file;
        const rawUrl = (logFile as any)?.downloadUrl;
        const filename = (logFile as any)?.filename;
        if (rawUrl) {
          const protocol = String(config.server?.protocol || 'http').toLowerCase();
          const host = config.server?.host || '';
          const port = config.server?.port ? `:${config.server.port}` : '';
          const serverUrl = `${protocol}://${host}${port}`;
          downloadUrl = rawUrl.startsWith('http') ? rawUrl : `${serverUrl}${rawUrl}`;
          downloadLabel = filename ? t('downloadFile', { filename }) : t('downloadDiagnosticLog');
        }
        const candidateTimeline = (res as any).data?.timeline
          ?? (res as any).data?.data?.timeline
          ?? (res as any).timeline
          ?? (res as any).data?.data?.timeline;
        if (Array.isArray(candidateTimeline)) {
          timeline = candidateTimeline as TimelineItem[];
        }
        rawThirdMsg = (res as any).data?.thirdMsg?.data
          ?? (res as any).data?.data?.thirdMsg?.data
          ?? (res as any).thirdMsg?.data
          ?? (res as any).data?.thirdMsg?.data;
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content,
        streaming: true,
        downloadUrl,
        downloadLabel,
        timeline,
        rawThirdMsg,
      };

      const final = [...optimisticMsgs, assistantMsg];
      setMessages(final);
      saveMessages(final);

      const streamIntervalMs = getStreamIntervalMs(config.app?.streamSpeed);
      setTimeout(() => {
        setMessages((prev) => {
          const updated = prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant'
              ? { ...m, streaming: false }
              : m
          );
          saveMessages(updated);
          return updated;
        });
      }, (content.length / STREAM_CHUNK_SIZE) * streamIntervalMs + 100);
    } catch (err: any) {
      log.error('API 调用失败', err);
      const errMsg: Message = {
        role: 'assistant',
        content: t('requestFailed') + getFriendlyErrorMessage(err, t),
      };
      setMessages([...optimisticMsgs, errMsg]);
      saveMessages([...optimisticMsgs, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, saveMessages, config.configId, config.llm, config.app?.streamSpeed, hasServerConfig, backendOnline, t]);

  const testServer = useCallback(async () => {
    setServerTestStatus(t('testing'));
    try {
      const result = await communicationService.healthCheck(config.server);
      setServerTestStatus(
        result.success ? t('connectSuccess') : `${t('connectFailed')}: ${result.error || t('unknown')}`
      );
    } catch (e: any) {
      setServerTestStatus(`${t('connectError')}: ${getFriendlyErrorMessage(e)}`);
    }
  }, [config.server, t]);

  const testDatabase = useCallback(async () => {
    setDbTestStatus(t('testing'));
    try {
      const res = await communicationService.callApiJson('/api/db/check', {
        method: 'POST',
        body: config.database,
        timeoutMs: 15000,
      });
      setDbTestStatus((res as any).success ? t('connectSuccess') : `${t('connectFailed')}: ${(res as any).message || t('unknown')}`);
    } catch (e: any) {
      setDbTestStatus(`${t('connectError')}: ${getFriendlyErrorMessage(e)}`);
    }
  }, [config.database, t]);

  const testOps = useCallback(async () => {
    setOpsTestStatus(t('testing'));
    try {
      const res = await communicationService.callApiJson('/api/ops-service/connect/check', {
        method: 'POST',
        body: {
          ip: config.ops.ip,
          port: config.ops.port,
        },
        timeoutMs: 15000,
      });
      const ok = typeof (res as any)?.success === 'boolean' ? (res as any).success : true;
      const msg = (res as any)?.message || (res as any)?.error;
      setOpsTestStatus(ok ? t('connectSuccess') : `${t('connectFailed')}: ${msg || t('unknown')}`);
    } catch (e: any) {
      setOpsTestStatus(`${t('connectError')}: ${getFriendlyErrorMessage(e)}`);
    }
  }, [config.ops, t]);

  const fetchComponentVersions = useCallback(async () => {
    if (!hasServerConfig()) return;
    if (!isConfigSaved) return;
    setVersionLoading(true);
    try {
      // 精简默认返回：GET /api/ops-service/packages/version（无 includeItems）
      const res = await communicationService.callApiJson('/api/ops-service/packages/version', {
        method: 'GET',
        query: {
          configId: config.configId,
          preferInstalled: true,
        },
        timeoutMs: 20000,
      });

      const unwrap = (v: any): any => {
        if (!v || typeof v !== 'object') return v;
        return v.data?.data ?? v.data ?? v.result ?? v;
      };

      const payload = unwrap(res);

      const pickVersionFromPkg = (pkg: any): string | undefined => {
        if (!pkg || typeof pkg !== 'object') return undefined;
        const keys = [
          'version',
          'productVersion',
          'product_version',
          'versionNo',
          'version_no',
          'displayVersion',
          'display_version',
          'releaseVersion',
          'release_version',
          'pkgVersion',
          'pkg_version',
          'packageVersion',
          'package_version',
        ];
        for (const k of keys) {
          const v = pkg[k];
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return undefined;
      };

      // 1. 优先解析新格式：{ version, source, packages: { wms: {...}, rcs1: {...}, ops: {...} } }
      const packages = payload?.packages;
      if (packages && typeof packages === 'object' && !Array.isArray(packages)) {
        const versions: ComponentVersions = {};
        for (const [key, pkg] of Object.entries(packages)) {
          const ver = pickVersionFromPkg(pkg);
          if (!ver) continue;
          const keyLower = key.toLowerCase();
          if (!versions.rcs && (keyLower.includes('rcs') || keyLower.includes('rcms') || keyLower.includes('rtas'))) {
            versions.rcs = ver;
          } else if (!versions.iwms && (keyLower.includes('wms') || keyLower.includes('iwms'))) {
            versions.iwms = ver;
          } else if (!versions.ops && keyLower.includes('ops')) {
            versions.ops = ver;
          }
        }
        if (versions.rcs || versions.iwms || versions.ops) {
          setComponentVersions(versions);
          return;
        }
      }

      // 2. 回退旧格式：opsTree 不可用时，兼容 /package/product 等旧接口返回的 items/list/rows
      const list = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items)
          ? payload.items
          : (Array.isArray(payload?.list)
            ? payload.list
            : (Array.isArray(payload?.rows)
              ? payload.rows
              : [])));

      const pickCode = (item: any) => {
        const candidates = [
          item?.productCode,
          item?.product_code,
          item?.code,
        ];
        const v = candidates.find((x) => typeof x === 'string' && x.trim());
        return typeof v === 'string' ? v : '';
      };

      const pickName = (item: any) => {
        const candidates = [
          item?.productName,
          item?.product_name,
          item?.productCode,
          item?.product_code,
          item?.code,
          item?.name,
        ];
        const v = candidates.find((x) => typeof x === 'string' && x.trim());
        return typeof v === 'string' ? v : '';
      };

      const versions: ComponentVersions = {};
      for (const item of list) {
        const code = pickCode(item).toLowerCase();
        const name = pickName(item).toLowerCase();
        const key = `${code} ${name}`;
        const ver = pickVersionFromPkg(item);
        if (!ver) continue;
        if (!versions.rcs && (key.includes('rcs') || key.includes('rcms') || key.includes('rtas'))) {
          versions.rcs = ver;
        }
        if (!versions.iwms && (key.includes('iwms') || key.includes('wms'))) {
          versions.iwms = ver;
        }
        if (!versions.ops && (key.includes('ops') || key.includes('运维') || key.includes('运管'))) {
          versions.ops = ver;
        }
      }

      if (versions.rcs || versions.iwms || versions.ops) {
        setComponentVersions(versions);
      } else {
        setComponentVersions({});
      }
    } catch {
      setComponentVersions({});
    } finally {
      setVersionLoading(false);
    }
  }, [config.configId, hasServerConfig, isConfigSaved]);

  useEffect(() => {
    if (view !== 'chat') return;
    fetchComponentVersions();
  }, [view, fetchComponentVersions]);

  const saveAndGoChat = useCallback(async () => {
    await saveConfig();
    setView('chat');
  }, [saveConfig]);

  const serverConfigured = hasServerConfig();

  const downloadLog = useCallback(async () => {
    try {
      const res = await communicationService.downloadLog('latest.log');
      if (res.success && res.data) {
        const link = document.createElement('a');
        link.href = `data:${res.data.type};base64,${res.data.content}`;
        link.download = 'poelink-log.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notifyUser(t('logDownloaded'), 'success');
      } else {
        notifyUser(t('logDownloadFailed') + ': ' + (res.error || t('unknown')), 'error');
      }
    } catch (e: any) {
      notifyUser(t('downloadError') + ': ' + e.message, 'error');
    }
  }, [t, notifyUser]);

  const syncCookies = useCallback(async () => {
    try {
      await communicationService.sendMessageToBackground({ type: 'TRIGGER_COOKIE_SYNC' });
      notifyUser(t('cookieSyncTriggered'), 'success');
    } catch {
      notifyUser(t('cookieSyncFailed'), 'error');
    }
  }, [t, notifyUser]);

  const retryBackendStatus = useCallback(async () => {
    try {
      await communicationService.getBackendStatus(true);
    } catch {
      // 静默失败，storage 会更新
    }
  }, []);

  const body = (() => {
    if (view === 'welcome') {
      return (
        <WelcomeView
          lang={lang}
          onStartConfig={() => {
            setConfigEntry('welcome');
            setActiveConfigTab('service');
            setCurrentStep(1);
            setView('config');
          }}
        />
      );
    }

    if (view === 'config') {
      const pageTitle = isConfigured ? t('configCenter') : t('configWizard');
      const pageSubtitle = isConfigured ? t('configCenterSubtitle') : t('configWizardSubtitle');
      const canProceed = isStepComplete(currentStep);
      const canEnterChat = isStepComplete(1) && isStepComplete(2) && isStepComplete(3);

      const handleNextStep = async () => {
        if (!canProceed) {
          notifyUser(t('pleaseCompleteStep'), 'error');
          return;
        }
        if (!isConfigSaved) {
          const shouldSave = window.confirm(t('saveBeforeContinue'));
          if (shouldSave) {
            await saveConfig();
          }
        }
        setCurrentStep((p) => Math.min(3, p + 1));
      };

      const handleSaveAndGoChat = () => {
        if (!canEnterChat) {
          notifyUser(t('pleaseCompleteService'), 'error');
          return;
        }
        saveAndGoChat();
      };

      const handleSaveConfig = () => {
        saveConfig().then(() => {
          setSaveNotice(t('configSaved'));
          window.setTimeout(() => setSaveNotice(''), 2000);
        });
      };

      return (
        <ConfigView
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          onBack={() => setView(configEntry)}
          onClose={onClose}
          showCloseInHeader={showCloseInHeader}
          saveNotice={saveNotice}
          isConfigSaved={isConfigSaved}
          activeConfigTab={activeConfigTab}
          setActiveConfigTab={setActiveConfigTab}
          steps={steps}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          canProceed={canProceed}
          canEnterChat={canEnterChat}
          config={config}
          lang={lang}
          updateConfig={updateConfig as any}
          updateLlmConfig={updateLlmConfig}
          testServer={testServer}
          testDatabase={testDatabase}
          testOps={testOps}
          serverTestStatus={serverTestStatus}
          dbTestStatus={dbTestStatus}
          opsTestStatus={opsTestStatus}
          handleSaveConfig={handleSaveConfig}
          handleNextStep={handleNextStep}
          handleSaveAndGoChat={handleSaveAndGoChat}
          handleGotoLlmTab={() => {
            if (!canProceed) {
              notifyUser(t('pleaseCompleteStep'), 'error');
              return;
            }
            setActiveConfigTab('llm');
          }}
          syncCookies={syncCookies}
          downloadLog={downloadLog}
          clearChatHistory={clearChatHistory}
        />
      );
    }

    return (
      <ChatView
        onClose={onClose}
        showCloseInHeader={showCloseInHeader}
        lang={lang}
        serverConfigured={serverConfigured}
        backendOnline={backendOnline}
        onRetryStatus={retryBackendStatus}
        versionLoading={versionLoading}
        componentVersions={componentVersions}
        config={config}
        createNewSession={createNewSession}
        openConfig={() => {
          setConfigEntry('chat');
          setActiveConfigTab('service');
          setCurrentStep(1);
          setView('config');
        }}
        historyOpen={historyOpen}
        historyMounted={historyMounted}
        openHistory={openHistory}
        closeHistory={closeHistory}
        sessions={sessions}
        activeSessionId={activeSessionId}
        clearChatHistory={clearChatHistory}
        switchSession={switchSession}
        messages={messages}
        isLoading={isLoading}
        streamIntervalMs={getStreamIntervalMs(config.app?.streamSpeed)}
        messagesEndRef={messagesEndRef}
        goConfig={() => setView('config')}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleSend={handleSend}
      />
    );
  })();

  return body;
};

export default MainApp;
