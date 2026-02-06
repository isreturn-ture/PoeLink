import React from 'react';

import ChatInput from '../../../components/popup/ChatInput';
import Header from '../../../components/popup/Header';
import MessageBubble from '../../../components/popup/MessageBubble';

import type { ChatSession as StoredChatSession } from '../services/StorageService';
import type { AppConfig, ComponentVersions, Message } from '../types';

interface ChatViewProps {
  onClose?: () => void;
  showCloseInHeader?: boolean;

  serverConfigured: boolean;

  versionLoading: boolean;
  componentVersions: ComponentVersions;

  config: AppConfig;

  createNewSession: () => void;
  openConfig: () => void;

  historyOpen: boolean;
  historyMounted: boolean;
  openHistory: () => void;
  closeHistory: () => void;

  sessions: StoredChatSession[];
  activeSessionId: string;

  clearChatHistory: () => void;
  switchSession: (sessionId: string) => void;

  messages: Message[];
  isLoading: boolean;
  streamIntervalMs: number;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;

  goConfig: () => void;

  inputValue: string;
  setInputValue: (v: string) => void;
  handleSend: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({
  onClose,
  showCloseInHeader,
  serverConfigured,
  versionLoading,
  componentVersions,
  config,
  createNewSession,
  openConfig,
  historyOpen,
  historyMounted,
  openHistory,
  closeHistory,
  sessions,
  activeSessionId,
  clearChatHistory,
  switchSession,
  messages,
  isLoading,
  streamIntervalMs,
  messagesEndRef,
  goConfig,
  inputValue,
  setInputValue,
  handleSend,
}) => {
  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100">
      <Header
        title="PoeLink"
        startAddon={
          serverConfigured ? (
            versionLoading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : componentVersions.rcs || componentVersions.iwms ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                {componentVersions.rcs && (
                  <span className="badge badge-outline badge-xs whitespace-nowrap">RCS {componentVersions.rcs}</span>
                )}
                {componentVersions.iwms && (
                  <span className="badge badge-outline badge-xs whitespace-nowrap">IWMS {componentVersions.iwms}</span>
                )}
              </div>
            ) : null
          ) : null
        }
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
            onClick={createNewSession}
            title="新建对话"
            aria-label="新建对话"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={openConfig}
            title="设置"
            aria-label="设置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95"
          onClick={() => (historyOpen ? closeHistory() : openHistory())}
          aria-expanded={historyOpen}
          aria-label="历史聊天记录"
          title="历史聊天记录"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </Header>

      {historyMounted && (
        <div
          className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${historyOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={closeHistory}
          aria-hidden
        />
      )}
      {historyMounted && (
        <div
          className={`fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] bg-base-100 border-l border-base-300 shadow-2xl transform transition-transform duration-200 ease-out ${historyOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="h-full flex flex-col">
            <div className="shrink-0 p-4 border-b border-base-300 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-base-content">历史聊天记录</div>
                <div className="text-xs text-base-content/60">共 {sessions.length} 个会话</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={closeHistory}
                aria-label="关闭"
                title="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              <div className="flex">
                <button type="button" className="btn btn-ghost btn-sm w-full" onClick={clearChatHistory}>
                  清空全部
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="text-sm text-base-content/60 p-3">暂无会话</div>
              ) : (
                sessions.map((s) => {
                  const lastMsg = Array.isArray((s as any).messages)
                    ? (s as any).messages[(s as any).messages.length - 1]
                    : null;
                  const preview = String(lastMsg?.content || '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 60);
                  const isActive = s.id === activeSessionId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${isActive ? 'border-primary/50 bg-primary/5' : 'border-base-300 bg-base-100 hover:bg-base-200'}`}
                      onClick={() => switchSession(s.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-base-content/80 truncate">{s.title || '新会话'}</div>
                        <div className="text-[10px] text-base-content/50">
                          {Array.isArray((s as any).messages) ? (s as any).messages.length : 0} 条
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-base-content/70 break-words">{preview || '（空）'}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4 bg-base-100">
        {!serverConfigured && (
          <div className="rounded-2xl border border-warning/30 bg-base-100 px-4 py-3 text-sm text-warning-content flex flex-wrap items-center gap-3">
            <span className="font-medium">未完成配置，暂无法发起 AMR 排查。</span>
            <span className="text-xs opacity-70">请先完成服务器配置以启用助手。</span>
            <button type="button" className="btn btn-xs btn-warning ml-auto" onClick={goConfig}>
              去配置
            </button>
          </div>
        )}
        {!serverConfigured ? (
          <div className="flex flex-col items-center justify-center py-8 animate-fade-in-up text-center">
            <div className="avatar placeholder mb-4">
              <div className="w-20 h-20 rounded-full bg-warning/10 border-2 border-warning/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-base font-medium text-base-content/80 mb-1">尚未完成服务器配置</p>
            <p className="text-sm text-base-content/60">完成配置后即可使用 AMR 问题排查助手</p>
            <button type="button" className="btn btn-sm btn-warning mt-4" onClick={goConfig}>
              去配置
            </button>
          </div>
        ) : messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 animate-fade-in-up">
            <div className="avatar placeholder mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-base font-medium text-base-content/80 mb-1">还没有排查记录</p>
            <p className="text-sm text-center max-w-[240px] text-base-content/60">输入问题，启动 AMR 故障排查</p>
            <div className="flex gap-2 mt-4">
              <kbd className="kbd kbd-sm">Enter</kbd>
              <span className="text-xs text-base-content/50">发送</span>
              <kbd className="kbd kbd-sm">Shift+Enter</kbd>
              <span className="text-xs text-base-content/50">换行</span>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} index={i} streamIntervalMs={streamIntervalMs} />
            ))}
            {isLoading && (
              <div className="chat chat-start animate-fade-in-up">
                <div className="avatar placeholder shrink-0">
                  <div className="w-8 h-8 rounded-full bg-secondary text-secondary-content shadow-md">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
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

      {serverConfigured && (
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          disabled={isLoading || !serverConfigured}
        />
      )}
    </div>
  );
};

export default ChatView;
