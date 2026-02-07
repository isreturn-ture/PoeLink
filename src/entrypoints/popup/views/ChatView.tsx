import React from 'react';

import ChatInput from '../../../components/popup/ChatInput';
import Header from '../../../components/popup/Header';
import MessageBubble from '../../../components/popup/MessageBubble';
import { createAppI18n } from '../../../i18n';
import type { AppLocale } from '../../../i18n';

import type { ChatSession as StoredChatSession } from '../services/StorageService';
import type { AppConfig, ComponentVersions, Message } from '../types';
import { formatVersionForDisplay } from '../utils/versionDisplay';

interface ChatViewProps {
  onClose?: () => void;
  showCloseInHeader?: boolean;
  lang?: AppLocale;

  serverConfigured: boolean;
  /** 后端在线状态：true=在线, false=离线, null=检测中 */
  backendOnline?: boolean | null;
  /** 刷新后端状态（触发即时检测） */
  onRetryStatus?: () => void | Promise<void>;

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
  lang = 'zh-CN',
  serverConfigured,
  backendOnline = null,
  onRetryStatus,
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
  const { t } = createAppI18n(lang);
  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100">
      <Header
        title="PoeLink"
        startAddon={
          serverConfigured ? (
            versionLoading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : componentVersions.rcs || componentVersions.iwms || componentVersions.ops ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                {componentVersions.rcs && (
                  <span className="badge badge-outline badge-xs whitespace-nowrap">RCS {formatVersionForDisplay(componentVersions.rcs, 'rcs')}</span>
                )}
                {componentVersions.iwms && (
                  <span className="badge badge-outline badge-xs whitespace-nowrap">IWMS {formatVersionForDisplay(componentVersions.iwms, 'iwms')}</span>
                )}
                {componentVersions.ops && (
                  <span className="badge badge-outline badge-xs whitespace-nowrap">OPS {formatVersionForDisplay(componentVersions.ops, 'ops')}</span>
                )}
              </div>
            ) : null
          ) : null
        }
        subtitle={
          (() => {
            const hasServer = !!(config.server?.host?.trim() && config.server?.port?.trim());
            if (!hasServer) {
              return (
                <div className="flex items-center gap-2">
                  <span className="badge badge-ghost badge-sm">{t('notConfigured')}</span>
                </div>
              );
            }
            if (backendOnline === true) {
              return (
                <div className="flex items-center gap-2">
                  <span className="badge badge-success badge-sm gap-1">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    {t('online')}
                  </span>
                </div>
              );
            }
            if (backendOnline === false) {
              return (
                <div className="flex items-center gap-2">
                  <span className="badge badge-error badge-sm">{t('offline')}</span>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-2">
                <span className="badge badge-ghost badge-sm gap-1">
                  <span className="loading loading-spinner loading-xs" />
                  {t('checking')}
                </span>
              </div>
            );
          })()
        }
        onClose={onClose}
        showClose={showCloseInHeader}
        closeAriaLabel={t('close')}
      >
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square min-w-9 min-h-9 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-80 cursor-pointer"
            onClick={createNewSession}
            title={t('newChat')}
            aria-label={t('newChat')}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square min-w-9 min-h-9 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-80 cursor-pointer"
            onClick={openConfig}
            title={t('settings')}
            aria-label={t('settings')}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <span className="w-px h-5 bg-base-300 mx-0.5 hidden sm:block" aria-hidden />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square min-w-9 min-h-9 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-80 cursor-pointer"
            onClick={() => (historyOpen ? closeHistory() : openHistory())}
            aria-expanded={historyOpen}
            aria-label={t('chatHistory')}
            title={t('chatHistory')}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </Header>

      {historyMounted && (
        <div
          className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 cursor-pointer ${historyOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={closeHistory}
          aria-hidden
        />
      )}
      {historyMounted && (
        <div
          className={`fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] bg-base-100 border-l border-base-300 shadow-2xl transform transition-transform duration-200 ease-out ${historyOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="h-full flex flex-col">
            <div className="shrink-0 px-4 py-3 border-b border-base-300 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-base-content">{t('historyTitle')}</div>
                <div className="text-xs text-base-content/60 mt-0.5">{t('sessionsCount', { n: String(sessions.length) })}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square min-w-9 min-h-9 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-80 cursor-pointer"
                onClick={closeHistory}
                aria-label={t('close')}
                title={t('close')}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {sessions.length > 0 && (
                <div className="flex justify-end pb-1">
                  <button
                    type="button"
                    className="text-xs text-base-content/50 hover:text-error transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 rounded px-2 py-1"
                    onClick={clearChatHistory}
                  >
                    {t('clearAll')}
                  </button>
                </div>
              )}

              {sessions.length === 0 ? (
                <div className="text-sm text-base-content/60 p-3">{t('noSessions')}</div>
              ) : (
                sessions.map((s) => {
                  const sessionMessages = Array.isArray(s.messages) ? s.messages : [];
                  const lastMsg = sessionMessages[sessionMessages.length - 1] ?? null;
                  const preview = String(lastMsg?.content ?? '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 60);
                  const isActive = s.id === activeSessionId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-colors duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 ${isActive ? 'border-primary/50 bg-primary/5' : 'border-base-300 bg-base-100 hover:bg-base-200'}`}
                      onClick={() => switchSession(s.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-base-content/80 truncate">{s.title || t('newSession')}</div>
                        <div className="text-[10px] text-base-content/50">
                          {t('messagesCount', { n: String(sessionMessages.length) })}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-base-content/70 break-words">{preview || t('empty')}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 space-y-3 bg-base-100">
        {!serverConfigured && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm flex flex-wrap items-center gap-3">
            <span className="font-medium text-base-content">{t('notConfiguredWarning')}</span>
            <span className="text-xs text-base-content/70">{t('notConfiguredHint')}</span>
            <button
              type="button"
              className="btn btn-sm btn-warning ml-auto shrink-0 focus-visible:ring-2 focus-visible:ring-warning/40 focus-visible:ring-offset-2"
              onClick={goConfig}
            >
              {t('goConfig')}
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
            <p className="text-base font-medium text-base-content/80 mb-1">{t('serverNotConfiguredTitle')}</p>
            <p className="text-sm text-base-content/60 mb-4">{t('serverNotConfiguredHint')}</p>
            <button
              type="button"
              className="btn btn-warning focus-visible:ring-2 focus-visible:ring-warning/40 focus-visible:ring-offset-2"
              onClick={goConfig}
            >
              {t('goConfig')}
            </button>
          </div>
        ) : serverConfigured && backendOnline === false ? (
          <div
            className="flex flex-col items-center justify-center min-h-[240px] py-6 px-4 animate-fade-in-up"
            role="alert"
            aria-live="assertive"
            aria-label={t('backendOfflineHint')}
          >
            <div className="w-full max-w-md">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 rounded-2xl border border-error/20 bg-gradient-to-b from-error/5 to-transparent p-4 sm:p-6 shadow-lg shadow-error/5">
                <div className="shrink-0 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-error/10 border border-error/20">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 text-error"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-error/10 text-error text-[11px] font-medium tracking-wide mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" aria-hidden />
                    {t('offline')}
                  </div>
                  <h3 className="text-base font-semibold text-base-content mb-1 leading-snug tracking-tight">{t('backendOfflineHint')}</h3>
                  <p className="text-[13px] text-base-content/60 leading-relaxed">{t('backendOfflineSubtitle')}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 justify-center">
                <button
                  type="button"
                  className="btn btn-error btn-sm min-h-[40px] px-3 gap-2 text-sm focus-visible:ring-2 focus-visible:ring-error/40 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-90 cursor-pointer"
                  onClick={openConfig}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('goConfig')}
                </button>
                {onRetryStatus && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm min-h-[40px] px-3 gap-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-90 cursor-pointer"
                    onClick={onRetryStatus}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {t('retryStatus')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 animate-fade-in-up">
            <div className="avatar placeholder mb-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-[15px] font-medium text-base-content/80 mb-0.5 tracking-tight">{t('noHistoryTitle')}</p>
            <p className="text-[13px] text-center max-w-[260px] text-base-content/60 mb-3 leading-relaxed">{t('noHistoryHint')}</p>
            <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-lg bg-base-200/80 px-2.5 py-1.5 text-[11px] text-base-content/70">
              <span className="flex items-center gap-1.5">
                <kbd className="kbd kbd-sm bg-base-300 border-base-300">Enter</kbd>
                <span>{t('send')}</span>
              </span>
              <span className="w-px h-4 bg-base-300 shrink-0" aria-hidden />
              <span className="flex items-center gap-1.5">
                <kbd className="kbd kbd-sm bg-base-300 border-base-300">Shift+Enter</kbd>
                <span>{t('newline')}</span>
              </span>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} index={i} streamIntervalMs={streamIntervalMs} t={t} />
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
        <div className="shrink-0 border-t border-base-300">
          {backendOnline === false && (
            <div
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-error/5 border-b border-error/10 text-error text-[11px] font-medium tracking-wide"
              role="status"
              aria-label={t('inputDisabledOffline')}
            >
              <svg className="w-4 h-4 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{t('inputDisabledOffline')}</span>
            </div>
          )}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={isLoading || !serverConfigured || backendOnline === false}
            placeholder={t('inputPlaceholder')}
            inputAriaLabel={t('inputAriaLabel')}
            sendAriaLabel={t('sendAriaLabel')}
          />
        </div>
      )}
    </div>
  );
};

export default ChatView;
