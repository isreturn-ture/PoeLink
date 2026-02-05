import React, { useState, useEffect, useCallback, useRef } from 'react';
import { browser } from 'wxt/browser';
import communicationService from './services/CommunicationService';
import storageService, { type ChatSession as StoredChatSession } from './services/StorageService';
import { analyzeInputOnce, recognizeIntent } from './services/IntentService';
import { extractEntities } from './services/EntityService';
import { createLogger } from '../../utils/logger';

import WelcomeView from './views/WelcomeView';
import ConfigView from './views/ConfigView';
import ChatView from './views/ChatView';

import {
  defaultConfig,
  type AppConfig,
  type AppProps,
  type AppSettings,
  type ComponentVersions,
  type ConfigSection,
  type LLMConfig,
  type Message,
  type TimelineItem,
} from './types';

const log = createLogger('popup');

const STREAM_CHUNK_SIZE = 3;
const getStreamIntervalMs = (speed: AppSettings['streamSpeed'] | undefined) => {
  if (speed === 'fast') return 10;
  if (speed === 'slow') return 40;
  return 20;
};

const applyThemeSetting = (theme: AppSettings['theme'] | undefined, systemPrefersDark?: boolean) => {
  if (typeof window === 'undefined') return;
  const doc = window.document?.documentElement;
  if (!doc) return;

  const mode = theme || 'system';
  if (mode === 'light' || mode === 'dark') {
    doc.setAttribute('data-theme', mode);
    doc.classList.toggle('dark', mode === 'dark');
    return;
  }

  const isDark = typeof systemPrefersDark === 'boolean'
    ? systemPrefersDark
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  doc.setAttribute('data-theme', isDark ? 'dark' : 'light');
  doc.classList.toggle('dark', !!isDark);
};

const getFriendlyErrorMessage = (err: unknown) => {
  if (typeof err === 'string') return '服务暂时不可用，请稍后再试。';
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = String((err as { message?: string }).message ?? '');
    if (raw.toLowerCase().includes('network')) return '网络异常，请检查网络连接后再试。';
    if (raw.toLowerCase().includes('fetch')) return '服务暂时不可用，请稍后再试。';
  }
  return '服务暂时不可用，请稍后再试。';
};

// ================== 主组件 ==================

const App: React.FC<AppProps> = ({ onClose, showCloseInHeader = true }) => {
  const [view, setView] = useState<'welcome' | 'chat' | 'config'>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const [componentVersions, setComponentVersions] = useState<ComponentVersions>({});
  const [versionLoading, setVersionLoading] = useState(false);

  const [config, setConfig] = useState<AppConfig>(() => defaultConfig);
  const [currentStep, setCurrentStep] = useState(1);
  const [activeConfigTab, setActiveConfigTab] = useState<'service' | 'llm' | 'app'>('service');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [configEntry, setConfigEntry] = useState<'welcome' | 'chat'>('welcome');

  const [serverTestStatus, setServerTestStatus] = useState('');
  const [dbTestStatus, setDbTestStatus] = useState('');
  const [opsTestStatus, setOpsTestStatus] = useState('');

  const HISTORY_ANIM_MS = 220;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMounted, setHistoryMounted] = useState(false);
  const historyUnmountTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const steps = ['服务器配置', '数据库配置', '运管系统配置'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const openHistory = useCallback(() => {
    if (historyUnmountTimerRef.current != null) {
      window.clearTimeout(historyUnmountTimerRef.current);
      historyUnmountTimerRef.current = null;
    }
    setHistoryMounted(true);
    window.requestAnimationFrame(() => setHistoryOpen(true));
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  useEffect(() => {
    if (!historyMounted) return;
    if (historyOpen) return;

    if (historyUnmountTimerRef.current != null) {
      window.clearTimeout(historyUnmountTimerRef.current);
      historyUnmountTimerRef.current = null;
    }

    historyUnmountTimerRef.current = window.setTimeout(() => {
      setHistoryMounted(false);
      historyUnmountTimerRef.current = null;
    }, HISTORY_ANIM_MS);

    return () => {
      if (historyUnmountTimerRef.current != null) {
        window.clearTimeout(historyUnmountTimerRef.current);
        historyUnmountTimerRef.current = null;
      }
    };
  }, [historyOpen, historyMounted, HISTORY_ANIM_MS]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mode = config.app?.theme ?? 'system';
    const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    if (mode !== 'system' || !mql) {
      applyThemeSetting(mode);
      return;
    }

    const handler = (e?: MediaQueryListEvent) => {
      applyThemeSetting('system', e ? e.matches : mql.matches);
    };

    handler();
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else (mql as any).addListener(handler);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else (mql as any).removeListener(handler);
    };
  }, [config.app?.theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isConfigView = view === 'config';
    const width = Math.min(window.innerWidth * 0.95, isConfigView ? 920 : 720);
    const height = Math.min(window.innerHeight * 0.9, isConfigView ? 640 : 520);
    window.postMessage(
      { source: 'POELink', type: 'SET_UI_SIZE', width, height },
      '*'
    );
  }, [view]);

  // 加载配置和历史消息
  useEffect(() => {
    let mounted = true;

    (async () => {
      const savedConfig = await storageService.getConfig();
      if (savedConfig && mounted) {
        setConfig({
          ...defaultConfig,
          ...savedConfig,
          llm: {
            ...(defaultConfig.llm ?? { apiKey: '', provider: 'siliconflow', model: '' }),
            ...(savedConfig.llm ?? {}),
          },
          app: {
            ...defaultConfig.app,
            ...((savedConfig as any).app ?? {}),
          },
        });
        const hasServer = !!(savedConfig.server?.host?.trim() && savedConfig.server?.port?.trim());
        setIsConfigured(hasServer);
        setIsConfigSaved(true);
        if (hasServer) {
          setView('chat');
        }
      }

      const init = await storageService.initSessions();
      if (mounted) {
        setSessions(init.sessions);
        setActiveSessionId(init.activeSessionId);
        const active = init.sessions.find(s => s && s.id === init.activeSessionId);
        setMessages((active?.messages as any) ?? []);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = (changes: Record<string, any>, areaName: string) => {
      if (areaName !== 'local') return;

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_messages')) {
        const next = changes.poelink_messages?.newValue as Message[] | undefined;
        if (Array.isArray(next)) setMessages(next);
        else if (next == null) setMessages([]);
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_sessions')) {
        const next = changes.poelink_sessions?.newValue as StoredChatSession[] | undefined;
        if (Array.isArray(next)) setSessions(next);
        else if (next == null) setSessions([]);
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_active_session_id')) {
        const nextId = changes.poelink_active_session_id?.newValue;
        if (typeof nextId === 'string') setActiveSessionId(nextId);
        else if (nextId == null) setActiveSessionId('');
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_config')) {
        const nextCfg = changes.poelink_config?.newValue as AppConfig | undefined;
        if (nextCfg) {
          setConfig({
            ...defaultConfig,
            ...nextCfg,
            llm: {
              ...(defaultConfig.llm ?? { apiKey: '', provider: 'siliconflow', model: '' }),
              ...(nextCfg.llm ?? {}),
            },
            app: {
              ...defaultConfig.app,
              ...((nextCfg as any).app ?? {}),
            },
          });
          const hasServer = !!(nextCfg.server?.host?.trim() && nextCfg.server?.port?.trim());
          setIsConfigured(hasServer);
          setIsConfigSaved(true);
        } else {
          setConfig(defaultConfig);
          setIsConfigured(false);
          setIsConfigSaved(false);
        }
      }
    };

    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, []);

  const hasServerConfig = useCallback(() => {
    return !!(config.server?.host?.trim() && config.server?.port?.trim());
  }, [config.server]);

  const isStepComplete = useCallback((step: number) => {
    switch (step) {
      case 1:
        return !!(config.server?.host?.trim() && config.server?.port?.trim());
      case 2:
        return !!(config.database?.address?.trim() && config.database?.user?.trim() && config.database?.pass?.trim());
      case 3:
        return !!(config.ops?.ip?.trim() && String(config.ops?.port ?? '').trim());
      case 4:
        return true;
      default:
        return false;
    }
  }, [config.server, config.database, config.ops]);

  const notifyUser = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const runtimeBrowser = (globalThis as any).browser ?? (globalThis as any).chrome;
    const iconUrl = runtimeBrowser?.runtime?.getURL
      ? runtimeBrowser.runtime.getURL('icon/icons8-bot-32.png')
      : undefined;
    communicationService.sendNotification({
      type: 'basic',
      title: 'PoeLink',
      message,
      iconUrl,
    });
  }, []);

  const saveMessages = useCallback(async (msgs: Message[]) => {
    try {
      let sid = activeSessionId;
      if (!sid) {
        const init = await storageService.initSessions();
        sid = init.activeSessionId;
        setSessions(init.sessions);
        setActiveSessionId(init.activeSessionId);
      }

      await storageService.updateSessionMessages(sid, msgs as any);
      const latest = await storageService.getSessions();
      setSessions(latest);
    } catch (err) {
      log.warn('保存消息失败', err);
    }
  }, [activeSessionId]);

  const clearChatHistory = useCallback(async () => {
    try {
      await storageService.clearChatHistory();
      const init = await storageService.initSessions();
      setSessions(init.sessions);
      setActiveSessionId(init.activeSessionId);
      const active = init.sessions.find(s => s && s.id === init.activeSessionId);
      setMessages((active?.messages as any) ?? []);
    } catch (err) {
      log.warn('清除聊天记录失败', err);
    }
  }, []);

  const createNewSession = useCallback(async () => {
    if (messages.length === 0) {
      closeHistory();
      return;
    }
    try {
      const session = await storageService.createSession([]);
      const latest = await storageService.getSessions();
      setSessions(latest);
      setActiveSessionId(session.id);
      setMessages([]);
      closeHistory();
    } catch (err) {
      log.warn('创建会话失败', err);
    }
  }, [closeHistory, messages.length]);

  const switchSession = useCallback(async (sessionId: string) => {
    try {
      const session = await storageService.activateSession(sessionId);
      if (!session) return;
      setActiveSessionId(session.id);
      setMessages((session.messages as any) ?? []);
      const latest = await storageService.getSessions();
      setSessions(latest);
      closeHistory();
    } catch (err) {
      log.warn('切换会话失败', err);
    }
  }, [closeHistory]);

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
        content: '当前未完成配置，AMR 排查暂不可用。请先进入配置中心填写服务器信息。',
      };
      setMessages([...messages, tipMsg]);
      saveMessages([...messages, tipMsg]);
      setView('config');
      return;
    }

    const userMsg: Message = { role: 'user', content: inputValue.trim() };
    const optimisticMsgs = [...messages, userMsg];

    setMessages(optimisticMsgs);
    saveMessages(optimisticMsgs);
    setInputValue('');
    setIsLoading(true);

    try {
      // 1. 前端完成意图识别和实体抽取（因后端无外网）
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
        const fallback = '你好，我是 PoeLink 助手。你可以描述需要排查的问题，或提供任务号/车号/时间范围，我会帮你分析。';
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
          content: String(assistantReply).trim() || '你好，有什么我可以帮你的吗？'
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
          ai_analysis: {
            ...(intentResult.ai_analysis || {}),
            intent: 'query_status',
            description: '任务状态查询'
          }
        };
      }

      // 2. 统一通过 Chat 接口请求后端
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
        : (res.result ?? res.message ?? '服务暂时不可用，请稍后再试。');

      let downloadUrl: string | undefined;
      let downloadLabel: string | undefined;
      let timeline: TimelineItem[] | undefined;
      let rawThirdMsg: unknown;
      if (res && typeof res === 'object') {
        const logFile = res.data?.log_file ?? res.data?.result?.log_file ?? res.data?.data?.log_file;
        const rawUrl = logFile?.downloadUrl;
        const filename = logFile?.filename;
        if (rawUrl) {
          const protocol = String(config.server?.protocol || 'http').toLowerCase();
          const host = config.server?.host || '';
          const port = config.server?.port ? `:${config.server.port}` : '';
          const serverUrl = `${protocol}://${host}${port}`;
          downloadUrl = rawUrl.startsWith('http') ? rawUrl : `${serverUrl}${rawUrl}`;
          downloadLabel = filename ? `下载 ${filename}` : '下载诊断日志';
        }
        const candidateTimeline = res.data?.timeline
          ?? res.data?.data?.timeline
          ?? (res as any)?.timeline
          ?? (res as any)?.data?.data?.timeline;
        if (Array.isArray(candidateTimeline)) {
          timeline = candidateTimeline as TimelineItem[];
        }
        rawThirdMsg = res.data?.thirdMsg?.data
          ?? res.data?.data?.thirdMsg?.data
          ?? (res as any)?.thirdMsg?.data
          ?? (res as any)?.data?.thirdMsg?.data;
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
      // 流式展示完成后移除 streaming 标记并保存
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
        content: `抱歉，请求失败。${getFriendlyErrorMessage(err)}`,
      };
      setMessages([...optimisticMsgs, errMsg]);
      saveMessages([...optimisticMsgs, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, saveMessages, config.configId, config.llm, config.app?.streamSpeed, hasServerConfig]);

  const updateConfig = useCallback(<K extends ConfigSection, F extends keyof AppConfig[K]>(
    section: K,
    field: F,
    value: AppConfig[K][F]
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    setIsConfigSaved(false);
  }, []);

  const updateLlmConfig = useCallback((field: keyof LLMConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      llm: {
        ...(prev.llm || { apiKey: '', provider: 'siliconflow', model: '' }),
        [field]: value,
      },
    }));
    setIsConfigSaved(false);
  }, []);

  const testServer = useCallback(async () => {
    setServerTestStatus('测试中...');
    try {
      const ok = await communicationService.healthCheck(config.server);
      setServerTestStatus(ok.success ? '连接成功' : `失败：${ok.error || '未知'}`);
    } catch (e: any) {
      setServerTestStatus(`异常：${getFriendlyErrorMessage(e)}`);
    }
  }, [config.server]);

  const testDatabase = useCallback(async () => {
    setDbTestStatus('测试中...');
    try {
      // 真实调用：通过后端代理测试数据库连接
      // 假设后端有一个 /api/db/check 接口
      const res = await communicationService.callApiJson('/api/db/check', {
        method: 'POST',
        body: config.database,
        timeoutMs: 15000,
      });
      setDbTestStatus(res.success ? '连接成功' : `失败: ${res.message || '未知错误'}`);
    } catch (e: any) {
      setDbTestStatus(`异常：${getFriendlyErrorMessage(e)}`);
    }
  }, [config.database]);

  const testOps = useCallback(async () => {
    setOpsTestStatus('测试中...');
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
      setOpsTestStatus(ok ? '连接成功' : `失败: ${msg || '未知错误'}`);
    } catch (e: any) {
      setOpsTestStatus(`异常：${getFriendlyErrorMessage(e)}`);
    }
  }, [config.ops]);

  const fetchComponentVersions = useCallback(async () => {
    if (!hasServerConfig()) return;
    if (!isConfigSaved) return;
    setVersionLoading(true);
    try {
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

      const readDirect = (obj: any): ComponentVersions | null => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
        const getStr = (...keys: string[]) => {
          for (const k of keys) {
            const v = obj?.[k];
            if (typeof v === 'string' && v.trim()) return v.trim();
          }
          return undefined;
        };
        const rcs = getStr('rcs', 'RCS', 'rcsVersion', 'rcs_version', 'rcs_ver', 'rcsVer');
        const iwms = getStr('iwms', 'IWMS', 'iwmsVersion', 'iwms_version', 'iwms_ver', 'iwmsVer', 'wms', 'WMS', 'wmsVersion', 'wms_version');
        if (!rcs && !iwms) return null;
        return { rcs, iwms };
      };

      const direct = readDirect(payload);
      if (direct) {
        setComponentVersions(direct);
        return;
      }

      const list = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items)
          ? payload.items
          : (Array.isArray(payload?.list)
            ? payload.list
            : (Array.isArray(payload?.rows)
              ? payload.rows
              : [])));

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

      const pickCode = (item: any) => {
        const candidates = [
          item?.productCode,
          item?.product_code,
          item?.code,
        ];
        const v = candidates.find((x) => typeof x === 'string' && x.trim());
        return typeof v === 'string' ? v : '';
      };

      const pickVersion = (item: any) => {
        const candidates = [
          item?.version,
          item?.productVersion,
          item?.product_version,
          item?.versionNo,
          item?.version_no,
          item?.productVersionNo,
          item?.product_version_no,
          item?.displayVersion,
          item?.display_version,
          item?.releaseVersion,
          item?.release_version,
          item?.pkgVersion,
          item?.pkg_version,
          item?.packageVersion,
          item?.package_version,
        ];
        const v = candidates.find((x) => typeof x === 'string' && x.trim());
        return typeof v === 'string' ? v : '';
      };

      const versions: ComponentVersions = {};
      for (const item of list) {
        const code = pickCode(item).toLowerCase();
        const name = pickName(item).toLowerCase();
        const key = `${code} ${name}`;
        const ver = pickVersion(item);
        if (!ver) continue;
        if (!versions.rcs && (key.includes('rcs') || key.includes('rcms') || key.includes('rtas'))) {
          versions.rcs = ver;
        }
        if (!versions.iwms && (key.includes('iwms') || key.includes('wms'))) {
          versions.iwms = ver;
        }
      }

      if (versions.rcs || versions.iwms) {
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

  const saveConfig = useCallback(async () => {
    let configId: string | undefined;
    try {
      const validateResp = await communicationService.validateConfig(config);
      configId = validateResp?.data?.data?.config_id;
    } catch {
      configId = undefined;
    }
    const nextConfig = {
      ...config,
      configId,
      llm: config.llm ?? { apiKey: '', provider: 'siliconflow', model: '' }
    };
    await storageService.setConfig(nextConfig);
    setConfig(nextConfig);
    setIsConfigured(!!(nextConfig.server?.host?.trim() && nextConfig.server?.port?.trim()));
    setIsConfigSaved(true);
  }, [config]);

  const saveAndGoChat = useCallback(async () => {
    await saveConfig();
    setView('chat');
  }, [saveConfig]);

  const serverConfigured = hasServerConfig();

  const downloadLog = async () => {
    try {
      const res = await communicationService.downloadLog('latest.log');
      if (res.success && res.data) {
        const link = document.createElement('a');
        link.href = `data:${res.data.type};base64,${res.data.content}`;
        link.download = 'poelink-log.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notifyUser('日志已下载', 'success');
      } else {
        notifyUser('日志下载失败: ' + (res.error || '未知错误'), 'error');
      }
    } catch (e: any) {
      notifyUser('下载异常: ' + e.message, 'error');
    }
  };

  const syncCookies = async () => {
    try {
      await communicationService.sendMessageToBackground({ type: 'TRIGGER_COOKIE_SYNC' });
      notifyUser('已触发 Cookie 同步', 'success');
    } catch (err) {
      notifyUser('触发 Cookie 同步失败', 'error');
    }
  };

  // ================== 渲染 ==================
  if (view === 'welcome') {
    return (
      <WelcomeView
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
    const pageTitle = isConfigured ? '配置中心' : '配置向导';
    const pageSubtitle = isConfigured ? '调整排查助手的连接与能力配置' : '完成以下设置以启用 AMR 排查功能';
    const canProceed = isStepComplete(currentStep);
    const canEnterChat = isStepComplete(1) && isStepComplete(2) && isStepComplete(3);

    const handleNextStep = async () => {
      if (!canProceed) {
        notifyUser('请先完成当前步骤配置', 'error');
        return;
      }
      if (!isConfigSaved) {
        const shouldSave = window.confirm('当前配置尚未保存，是否先保存再继续？');
        if (shouldSave) {
          await saveConfig();
        }
      }
      setCurrentStep((p) => Math.min(3, p + 1));
    };

    const handleSaveAndGoChat = () => {
      if (!canEnterChat) {
        notifyUser('请先完成服务配置', 'error');
        return;
      }
      saveAndGoChat();
    };

    const handleSaveConfig = () => {
      saveConfig().then(() => {
        setSaveNotice('配置已保存');
        window.setTimeout(() => setSaveNotice(''), 2000);
      });
    };

    const lang = config.app?.language ?? 'zh-CN';

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
            notifyUser('请先完成当前步骤配置', 'error');
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

  // Chat 视图
  return (
    <ChatView
      onClose={onClose}
      showCloseInHeader={showCloseInHeader}
      serverConfigured={serverConfigured}
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
};

export default App;
