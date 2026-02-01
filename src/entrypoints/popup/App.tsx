import React, { useState, useEffect, useCallback, useRef } from 'react';
import communicationService from './services/CommunicationService';
import storageService from './services/StorageService';
import { recognizeIntent } from './services/IntentService';
import { extractEntities } from './services/EntityService';

interface AppProps {
  onClose?: () => void;
  /** 在悬浮窗模式下由外层提供关闭按钮，不显示 Header 内关闭 */
  showCloseInHeader?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean; // 流式输出中
  downloadUrl?: string;
  downloadLabel?: string;
  timeline?: TimelineItem[];
  rawThirdMsg?: unknown;
}

interface TimelineItem {
  taskChainCode: string;
  subTaskCode: string;
  reqCode: string;
  actName: string;
  sender: string;
  receiver: string;
  amrCode: string;
  carrierCode: string;
  slotCode: string;
  cooX: string | number;
  cooY: string | number;
  createTime: string;
  startTime: string;
  updateTime: string;
  statusName: string;
}

interface ServerConfig {
  protocol: 'HTTP' | 'HTTPS';
  host: string;
  port: string;
}

interface DatabaseConfig {
  address: string;
  user: string;
  pass: string;
}

interface OpsConfig {
  ip: string;
  port: string;
}

interface LLMConfig {
  apiKey: string;
  provider: 'moonshot' | 'openai';
  baseURL?: string;
}

interface AppConfig {
  configId?: string;
  server: ServerConfig;
  database: DatabaseConfig;
  ops: OpsConfig;
  llm?: LLMConfig;
}

type ConfigSection = Exclude<keyof AppConfig, 'configId' | 'llm'>;

const defaultConfig: AppConfig = {
  server: { protocol: 'HTTP', host: 'localhost', port: '7406' },
  database: { address: '', user: '', pass: '' },
  ops: { ip: '', port: '' },
  llm: { apiKey: '', provider: 'moonshot' },
};

// ================== 小组件开始 ==================

const BrandLogo = ({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';
  const iconClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';

  return (
    <div className={`${sizeClass} bg-primary rounded-xl flex items-center justify-center text-primary-content shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 ${className}`}>
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    </div>
  );
};

const Header = ({ title, subtitle, onBack, onClose, showClose = true, children }: {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  children?: React.ReactNode;
}) => (
  <header className="navbar bg-base-100 border-b border-base-300 shrink-0 px-4 py-3">
    <div className="navbar-start">
      <div className="flex items-center gap-3">
        <BrandLogo />
        <div>
          <h3 className="font-semibold text-base-content">{title}</h3>
          {subtitle && <p className="text-xs text-base-content/70">{subtitle}</p>}
        </div>
      </div>
    </div>
    <div className="navbar-end gap-1">
      {children}
      {onBack && (
        <button type="button" className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95" onClick={onBack} aria-label="返回">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {onClose && showClose && (
        <button type="button" className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 transition-all duration-200 hover:scale-110 active:scale-95" onClick={onClose} aria-label="关闭">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  </header>
);

const ChatInput = ({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  return (
    <div className="shrink-0 p-4 bg-base-100 border-t border-base-300">
      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          className="textarea flex-1 resize-none min-h-[44px] max-h-[120px] text-base transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          placeholder="输入消息，Enter 发送"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn-primary btn-circle shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="发送"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const STREAM_CHUNK_SIZE = 3;
const STREAM_INTERVAL_MS = 20;

const getFriendlyErrorMessage = (err: unknown) => {
  if (typeof err === 'string') return '服务暂时不可用，请稍后再试。';
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = String((err as { message?: string }).message ?? '');
    if (raw.toLowerCase().includes('network')) return '网络异常，请检查网络连接后再试。';
    if (raw.toLowerCase().includes('fetch')) return '服务暂时不可用，请稍后再试。';
  }
  return '服务暂时不可用，请稍后再试。';
};

const MessageBubble = ({ msg, index }: { msg: Message; index: number }) => {
  const [displayLen, setDisplayLen] = useState(msg.streaming ? 0 : msg.content.length);
  const fullLen = msg.content.length;

  useEffect(() => {
    if (!msg.streaming) {
      setDisplayLen(fullLen);
      return;
    }
    if (displayLen >= fullLen) return;
    const t = setInterval(() => {
      setDisplayLen((prev) => Math.min(prev + STREAM_CHUNK_SIZE, fullLen));
    }, STREAM_INTERVAL_MS);
    return () => clearInterval(t);
  }, [msg.streaming, fullLen, displayLen]);

  const text = msg.streaming ? msg.content.slice(0, displayLen) : msg.content;
  const isUser = msg.role === 'user';

  const timeline = Array.isArray(msg.timeline) ? msg.timeline : [];
  const rawThirdMsg = msg.rawThirdMsg;

  return (
    <div className={`chat ${isUser ? 'chat-user-right' : 'chat-ai-left'} animate-slide-up`} style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}>
      <div className="avatar placeholder shrink-0">
        <div className={`w-8 h-8 rounded-full ${isUser ? 'bg-primary' : 'bg-secondary'} text-primary-content shadow-md`}>
          {isUser ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          )}
        {!isUser && timeline.length === 0 && !!rawThirdMsg && (
          <details className="mt-4 rounded-xl border border-base-300 bg-base-100/80 p-3 shadow-sm">
            <summary className="cursor-pointer text-xs font-semibold text-base-content/80">原始执行流水</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto text-[11px] text-base-content/70 whitespace-pre-wrap break-words">
              {String(JSON.stringify(rawThirdMsg, null, 2))}
            </pre>
          </details>
        )}
        </div>
      </div>
      <div className={`chat-bubble ${isUser ? 'chat-bubble-primary' : 'chat-bubble-neutral'} text-[15px] leading-relaxed max-w-[85%] sm:max-w-[80%] shadow-sm`}>
        <div className="whitespace-pre-wrap break-words">
          {text}
          {msg.streaming && displayLen < fullLen && (
            <span className="inline-block w-0.5 h-[1em] bg-base-content/50 ml-0.5 align-bottom animate-pulse" />
          )}
        </div>
        {!isUser && timeline.length > 0 && (
          <div className="mt-4 rounded-xl border border-base-300 bg-base-100/80 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-base-content/80">任务执行流水</h4>
              <span className="badge badge-outline badge-xs">{timeline.length} 条</span>
            </div>
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
              {timeline.map((item, idx) => (
                <div key={`${item.reqCode}-${idx}`} className="rounded-lg border border-base-200 bg-base-100 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-base-content/70">
                    <span className="badge badge-ghost badge-xs">{item.statusName || item.actName || '状态'}</span>
                    <span className="font-medium text-base-content">{item.actName || '动作'}</span>
                    <span className="text-base-content/50">{item.sender}→{item.receiver}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-base-content/70">
                    <span>任务: {item.taskChainCode}</span>
                    <span>子任务: {item.subTaskCode || '-'}</span>
                    <span>请求: {item.reqCode || '-'}</span>
                    <span>车号: {item.amrCode || '-'}</span>
                    <span>货架: {item.carrierCode || '-'}</span>
                    <span>位置: {item.slotCode || '-'} ({item.cooX || '-'}, {item.cooY || '-'})</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-base-content/50">
                    <span>创建: {item.createTime || '-'}</span>
                    <span>开始: {item.startTime || '-'}</span>
                    <span>更新: {item.updateTime || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!isUser && msg.downloadUrl && (
          <a
            href={msg.downloadUrl}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-medium text-base-content shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary"
            target="_blank"
            rel="noreferrer"
          >
            <span className="i-lucide-download" />
            {msg.downloadLabel || '下载诊断日志'}
          </a>
        )}
      </div>
    </div>
  );
};

// ================== 主组件 ==================

const App: React.FC<AppProps> = ({ onClose, showCloseInHeader = true }) => {
  const [view, setView] = useState<'welcome' | 'chat' | 'config'>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [config, setConfig] = useState<AppConfig>(() => defaultConfig);
  const [currentStep, setCurrentStep] = useState(1);
  const [isConfigured, setIsConfigured] = useState(false);

  const [serverTestStatus, setServerTestStatus] = useState('');
  const [dbTestStatus, setDbTestStatus] = useState('');
  const [opsTestStatus, setOpsTestStatus] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const steps = ['服务器配置', '数据库配置', '运管系统配置', 'LLM 配置'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 加载配置和历史消息
  useEffect(() => {
    let mounted = true;

    (async () => {
      const savedConfig = await storageService.getConfig();
      if (savedConfig && mounted) {
        setConfig({
          ...defaultConfig,
          ...savedConfig,
          llm: savedConfig.llm ?? defaultConfig.llm
        });
        setIsConfigured(true);
        setView('chat');
      }

      const savedMessages = await storageService.getMessages();
      if (savedMessages && mounted) {
        setMessages(savedMessages);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const hasServerConfig = useCallback(() => {
    return !!(config.server?.host?.trim() && config.server?.port?.trim());
  }, [config.server]);

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
      await storageService.setMessages(msgs);
    } catch (err) {
      console.warn('保存消息失败', err);
    }
  }, []);

  const clearChatHistory = useCallback(async () => {
    setMessages([]);
    try {
      await storageService.setMessages([]);
    } catch (err) {
      console.warn('清除聊天记录失败', err);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    if (!hasServerConfig()) {
      const tipMsg: Message = {
        role: 'assistant',
        content: '当前未完成配置，请先进入设置页面填写服务器信息后再试。',
      };
      setMessages([...messages, tipMsg]);
      saveMessages([...messages, tipMsg]);
      return;
    }

    const userMsg: Message = { role: 'user', content: inputValue.trim() };
    const optimisticMsgs = [...messages, userMsg];

    setMessages(optimisticMsgs);
    setInputValue('');
    setIsLoading(true);

    try {
      // 1. 前端完成意图识别和实体抽取（因后端无外网）
      const llmConfig = config.llm?.apiKey ? config.llm : null;
      let [intentResult, entities] = await Promise.all([
        recognizeIntent(userMsg.content, llmConfig),
        extractEntities(userMsg.content, llmConfig)
      ]);

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
      const res = await communicationService.callApi('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          input: userMsg.content,
          configId: config.configId,
          description: intentResult?.description,
          intentResult,
          entities
        }),
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
      // 流式展示完成后移除 streaming 标记并保存
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
      }, (content.length / STREAM_CHUNK_SIZE) * STREAM_INTERVAL_MS + 100);
    } catch (err: any) {
      console.error('API 调用失败', err);
      const errMsg: Message = {
        role: 'assistant',
        content: `抱歉，请求失败。${getFriendlyErrorMessage(err)}`,
      };
      setMessages([...optimisticMsgs, errMsg]);
      saveMessages([...optimisticMsgs, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, saveMessages, config.configId, config.llm, hasServerConfig]);

  const updateConfig = useCallback(<K extends ConfigSection>(
    section: K,
    field: keyof AppConfig[K],
    value: string
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }, []);

  const updateLlmConfig = useCallback((field: keyof LLMConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      llm: {
        ...(prev.llm || { apiKey: '', provider: 'moonshot' }),
        [field]: value,
      },
    }));
  }, []);

  const testServer = useCallback(async () => {
    setServerTestStatus('测试中...');
    try {
      const ok = await communicationService.healthCheck(config.server);
      setServerTestStatus(ok.success ? '连接成功' : `失败：${ok.error || '未知'}`);
      if (ok?.success) {
        await storageService.setConfig({
          ...config,
          llm: config.llm ?? { apiKey: '', provider: 'moonshot' }
        });
      }
    } catch (e: any) {
      setServerTestStatus(`异常：${getFriendlyErrorMessage(e)}`);
    }
  }, [config.server]);

  const testDatabase = useCallback(async () => {
    setDbTestStatus('测试中...');
    try {
      // 真实调用：通过后端代理测试数据库连接
      // 假设后端有一个 /api/db/check 接口
      const res = await communicationService.callApi('/api/db/check', {
        method: 'POST',
        body: JSON.stringify(config.database)
      });
      setDbTestStatus(res.success ? '连接成功' : `失败: ${res.message || '未知错误'}`);
      if (res?.success) {
        await storageService.setConfig({
          ...config,
          llm: config.llm ?? { apiKey: '', provider: 'moonshot' }
        });
      }
    } catch (e: any) {
      setDbTestStatus(`异常：${getFriendlyErrorMessage(e)}`);
    }
  }, [config.database]);

  const testOps = useCallback(async () => {
    setOpsTestStatus('测试中...');
    try {
      // 真实调用：通过后端代理测试运管系统
      const res = await communicationService.callApi('/api/ops/check', {
        method: 'POST',
        body: JSON.stringify(config.ops)
      });
      setOpsTestStatus(res.success ? '连接成功' : `失败: ${res.message || '未知错误'}`);
      if (res?.success) {
        await storageService.setConfig({
          ...config,
          llm: config.llm ?? { apiKey: '', provider: 'moonshot' }
        });
      }
    } catch (e: any) {
      setOpsTestStatus(`异常：${getFriendlyErrorMessage(e)}`);
    }
  }, [config.ops]);

  const saveAndGoChat = useCallback(async () => {
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
      llm: config.llm ?? { apiKey: '', provider: 'moonshot' }
    };
    await storageService.setConfig(nextConfig);
    setConfig(nextConfig);
    setIsConfigured(true);
    setView('chat');
  }, [config]);

  const serverConfigured = hasServerConfig();

  const downloadLog = async () => {
    setMenuOpen(false);
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
    setMenuOpen(false);
    try {
      await communicationService.sendMessageToBackground({ type: 'TRIGGER_COOKIE_SYNC' });
      notifyUser('已触发 Cookie 同步', 'success');
    } catch (e: any) {
      notifyUser('同步失败', 'error');
    }
  };

  // ================== 渲染 ==================
  if (view === 'welcome') {
    return (
      <div className="hero h-full min-h-0 !min-h-0 bg-base-200 animate-fade-in-up">
        <div className="hero-content flex-col py-8">
          <BrandLogo size="lg" className="mb-6" />
          <h1 className="text-2xl font-bold text-base-content">PoeLInk</h1>
          <p className="text-base-content/70 text-sm text-center mb-8">AMR 智能诊断助手</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button type="button" className="btn btn-primary flex-1 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" onClick={() => setView('config')}>
              开始配置
            </button>
            <button type="button" className="btn btn-outline btn-secondary flex-1 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" onClick={() => setView('chat')}>
              跳过配置
            </button>
          </div>
          <div className="divider divider-neutral my-6 w-48" />
          <p className="text-xs text-base-content/50">© 2026 PoeLInk</p>
        </div>
      </div>
    );
  }

  if (view === 'config') {
    const pageTitle = isConfigured ? '设置' : '配置向导';
    const pageSubtitle = isConfigured ? '修改应用配置' : '完成以下设置以启用完整功能';

    return (
      <div className="flex flex-col h-full min-h-0 bg-base-100">
        <Header
          title={pageTitle}
          subtitle={pageSubtitle}
          onBack={() => setView(isConfigured ? 'chat' : 'welcome')}
          onClose={onClose}
          showClose={showCloseInHeader}
        />

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {/* 步骤指示器 - daisyUI steps */}
          <ul className="steps steps-horizontal w-full mb-6 text-xs">
            {steps.map((stepName, index) => {
              const stepNum = index + 1;
              const isActive = currentStep >= stepNum;
              return (
                <li key={stepNum} className={`step transition-all duration-300 ${isActive ? 'step-primary' : ''}`}>
                  {stepName}
                </li>
              );
            })}
          </ul>

          {/* Step 1: 服务器配置 */}
          {currentStep === 1 && (
            <div className="animate-fade-in-up">
              <div className="card bg-base-200 shadow-sm card-border">
                <div className="card-body">
                  <h4 className="card-title">服务器配置</h4>
                  <div className="space-y-4">
                    <label className="label"><span className="label-text">协议</span></label>
                    <select className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" value={config.server.protocol} onChange={(e) => updateConfig('server', 'protocol', e.target.value as 'HTTP' | 'HTTPS')}>
                      <option value="HTTP">HTTP</option>
                      <option value="HTTPS">HTTPS</option>
                    </select>
                    <label className="label"><span className="label-text">主机/地址</span></label>
                    <input className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="例如 localhost 或 192.168.1.100" value={config.server.host} onChange={(e) => updateConfig('server', 'host', e.target.value)} />
                    <label className="label"><span className="label-text">端口</span></label>
                    <input className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="例如 8080" value={config.server.port} onChange={(e) => updateConfig('server', 'port', e.target.value)} />
                    <button type="button" className="btn btn-primary mt-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" onClick={testServer}>测试服务器连接</button>
                    {serverTestStatus && (
                      <div role="alert" className={`alert ${serverTestStatus.includes('成功') ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}>
                        <span>{serverTestStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 数据库配置 */}
          {currentStep === 2 && (
            <div className="animate-fade-in-up">
              <div className="card bg-base-200 shadow-sm card-border">
                <div className="card-body">
                  <h4 className="card-title">数据库配置</h4>
                  <div className="space-y-4">
                    <label className="label"><span className="label-text">地址</span></label>
                    <input className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="数据库地址" value={config.database.address} onChange={(e) => updateConfig('database', 'address', e.target.value)} />
                    <label className="label"><span className="label-text">用户名</span></label>
                    <input className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="数据库用户名" value={config.database.user} onChange={(e) => updateConfig('database', 'user', e.target.value)} />
                    <label className="label"><span className="label-text">密码</span></label>
                    <input type="password" className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="数据库密码" value={config.database.pass} onChange={(e) => updateConfig('database', 'pass', e.target.value)} />
                    <button type="button" className="btn btn-primary mt-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" onClick={testDatabase}>测试数据库连接</button>
                    {dbTestStatus && (
                      <div role="alert" className={`alert ${dbTestStatus.includes('成功') ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}>
                        <span>{dbTestStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 运管系统配置 */}
          {currentStep === 3 && (
            <div className="animate-fade-in-up">
              <div className="card bg-base-200 shadow-sm card-border">
                <div className="card-body">
                  <h4 className="card-title">运管系统配置</h4>
                  <div className="space-y-4">
                    <label className="label"><span className="label-text">IP地址</span></label>
                    <input className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="运管系统IP" value={config.ops.ip} onChange={(e) => updateConfig('ops', 'ip', e.target.value)} />
                    <label className="label"><span className="label-text">端口</span></label>
                    <input className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="运管系统端口" value={config.ops.port} onChange={(e) => updateConfig('ops', 'port', e.target.value)} />
                    <button type="button" className="btn btn-primary mt-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" onClick={testOps}>测试运管系统连接</button>
                    {opsTestStatus && (
                      <div role="alert" className={`alert ${opsTestStatus.includes('成功') ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}>
                        <span>{opsTestStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: LLM 配置 */}
          {currentStep === 4 && (
            <div className="animate-fade-in-up">
              <div className="card bg-base-200 shadow-sm card-border">
                <div className="card-body">
                  <h4 className="card-title">LLM 配置（API Key）</h4>
                  <p className="text-sm text-base-content/70 mb-4">后端无法连接外网，意图识别与实体抽取在前端完成。配置 API Key 后可使用 AI 识别，否则使用本地规则。</p>
                  <div className="space-y-4">
                    <label className="label"><span className="label-text">API Key</span></label>
                    <input type="password" className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" placeholder="Moonshot 或 OpenAI API Key（可选）" value={config.llm?.apiKey ?? ''} onChange={(e) => updateLlmConfig('apiKey', e.target.value)} />
                    <label className="label"><span className="label-text">提供商</span></label>
                    <select className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20" value={config.llm?.provider ?? 'moonshot'} onChange={(e) => updateLlmConfig('provider', e.target.value as 'moonshot' | 'openai')}>
                      <option value="moonshot">Moonshot (月之暗面 / Kimi)</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-base-300 bg-base-100">
          <div className="join join-horizontal w-full gap-2">
            <button type="button" className="btn btn-outline flex-1 join-item transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50" onClick={() => setCurrentStep(p => Math.max(1, p - 1))} disabled={currentStep === 1}>
              上一步
            </button>
            {currentStep < 4 ? (
              <button type="button" className="btn btn-primary flex-1 join-item transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" onClick={() => setCurrentStep(p => p + 1)}>
                下一步
              </button>
            ) : (
              <button type="button" className="btn btn-primary flex-1 join-item transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" onClick={saveAndGoChat}>
                保存并进入
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chat 视图
  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100">
      <Header
        title="PoeLInkBot"
        subtitle={
          (() => {
            const hasServer = !!(config.server?.host?.trim() && config.server?.port?.trim());
            return hasServer ? (
              <div className="flex items-center gap-2">
                <span className="badge badge-success badge-sm gap-1">
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                  在线
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="badge badge-ghost badge-sm">未配置</span>
              </div>
            );
          })()
        }
        onClose={onClose}
        showClose={showCloseInHeader}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={clearChatHistory}
            title="清除聊天记录"
            aria-label="清除聊天记录"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h7m8 0h3M6 6l1.5 14h9L18 6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2M9 10h.01M12 10h.01M15 10h.01" />
            </svg>
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95" onClick={() => setView('config')} title="设置" aria-label="设置">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <div className={`dropdown dropdown-end ${menuOpen ? 'dropdown-open' : ''}`}>
          <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95" onClick={() => setMenuOpen(v => !v)} onBlur={() => setTimeout(() => setMenuOpen(false), 150)} aria-expanded={menuOpen} aria-label="更多">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />}
          {menuOpen && (
            <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 rounded-box z-50 w-40 p-2 shadow-xl border border-base-300 mt-2 animate-slide-up">
              <li><button type="button" className="transition-colors" onClick={syncCookies}>同步 Cookie</button></li>
              <li><button type="button" className="transition-colors" onClick={downloadLog}>下载运行日志</button></li>
            </ul>
          )}
        </div>
      </Header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-base-100">
        {!serverConfigured && (
          <div className="rounded-2xl border border-warning/30 bg-base-100 px-4 py-3 text-sm text-warning-content flex flex-wrap items-center gap-3">
            <span className="font-medium">未完成配置，无法发送请求。</span>
            <span className="text-xs opacity-70">请先完成服务器配置。</span>
            <button
              type="button"
              className="btn btn-xs btn-warning ml-auto"
              onClick={() => setView('config')}
            >
              去配置
            </button>
          </div>
        )}
        {messages.length === 0 && !isLoading ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center py-12 animate-fade-in-up">
            <div className="avatar placeholder mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <p className="text-base font-medium text-base-content/80 mb-1">还没有消息</p>
            <p className="text-sm text-center max-w-[220px] text-base-content/60">输入问题，获取 AMR 智能诊断</p>
            <div className="flex gap-2 mt-4">
              <kbd className="kbd kbd-sm">Enter</kbd>
              <span className="text-xs text-base-content/50">发送</span>
              <kbd className="kbd kbd-sm">Shift+Enter</kbd>
              <span className="text-xs text-base-content/50">换行</span>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} index={i} />)}
            {isLoading && (
              <div className="chat chat-start animate-fade-in-up">
                <div className="avatar placeholder shrink-0">
                  <div className="w-8 h-8 rounded-full bg-secondary text-secondary-content shadow-md">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  </div>
                </div>
                <div className="chat-bubble chat-bubble-neutral shadow-sm">
                  <span className="loading loading-dots loading-sm" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isLoading || !serverConfigured}
      />
    </div>
  );
};

export default App;
