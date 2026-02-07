import React, { useEffect, useState } from 'react';

import { safeJsonStringify } from '../../utils/logger';

import type { Message, TimelineItem } from '../../entrypoints/popup/types';
import type { AppI18nKey } from '../../i18n';

type TFunc = (key: AppI18nKey, params?: Record<string, string | number>) => string;

const STREAM_CHUNK_SIZE = 3;

interface MessageBubbleProps {
  msg: Message;
  index: number;
  streamIntervalMs: number;
  t?: TFunc;
}

const MessageBubble = ({ msg, index, streamIntervalMs, t }: MessageBubbleProps) => {
  const _t: TFunc = t ?? ((k) => String(k));
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
    }, streamIntervalMs);
    return () => clearInterval(t);
  }, [msg.streaming, fullLen, displayLen, streamIntervalMs]);

  const text = msg.streaming ? msg.content.slice(0, displayLen) : msg.content;
  const isUser = msg.role === 'user';

  const timeline: TimelineItem[] = Array.isArray(msg.timeline) ? msg.timeline : [];
  const rawThirdMsg = msg.rawThirdMsg;

  return (
    <div
      className={`chat ${isUser ? 'chat-user-right' : 'chat-ai-left'} animate-slide-up`}
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      <div className="avatar placeholder shrink-0">
        <div className={`w-8 h-8 rounded-full ${isUser ? 'bg-primary' : 'bg-secondary'} text-primary-content shadow-md`}>
          {isUser ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          )}
        </div>
      </div>
      <div
        className={`chat-bubble ${isUser ? 'chat-bubble-primary' : 'chat-bubble-neutral'} max-w-[85%] sm:max-w-[80%] shadow-sm`}
      >
        <div className="whitespace-pre-wrap break-words">
          {text}
          {msg.streaming && displayLen < fullLen && (
            <span className="inline-block w-0.5 h-[1em] bg-base-content/50 ml-0.5 align-bottom animate-pulse" />
          )}
        </div>
        {!isUser && timeline.length === 0 && !!rawThirdMsg && (
          <details className="mt-4 rounded-xl border border-base-300 bg-base-100/80 p-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2">
            <summary className="cursor-pointer text-xs font-semibold text-base-content/80 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 rounded">{_t('rawTimeline')}</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto text-[11px] text-base-content/70 whitespace-pre-wrap break-words">
              {safeJsonStringify(rawThirdMsg, { depth: 12 })}
            </pre>
          </details>
        )}
        {!isUser && timeline.length > 0 && (
          <div className="mt-4 rounded-xl border border-base-300 bg-base-100/80 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-base-content/80">{_t('taskTimeline')}</h4>
              <span className="badge badge-outline badge-xs">{_t('timelineCount', { n: timeline.length })}</span>
            </div>
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
              {timeline.map((item, idx) => (
                <div key={`${item.reqCode}-${idx}`} className="rounded-lg border border-base-200 bg-base-100 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-base-content/70">
                    <span className="badge badge-ghost badge-xs">{item.statusName || item.actName || _t('status')}</span>
                    <span className="font-medium text-base-content">{item.actName || _t('action')}</span>
                    <span className="text-base-content/50">
                      {item.sender}→{item.receiver}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-base-content/70">
                    {item.taskChainCode && <span>{_t('task')}: {item.taskChainCode}</span>}
                    {item.subTaskCode && <span>{_t('subtask')}: {item.subTaskCode}</span>}
                    {item.reqCode && <span>{_t('request')}: {item.reqCode}</span>}
                    {item.amrCode && <span>{_t('amrCode')}: {item.amrCode}</span>}
                    {item.carrierCode && <span>{_t('carrier')}: {item.carrierCode}</span>}
                    {(item.slotCode || item.cooX || item.cooY) && (
                      <span>
                        {_t('location')}: {item.slotCode || '-'}
                        {item.cooX || item.cooY ? ` (${item.cooX || '-'}, ${item.cooY || '-'})` : ''}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-base-content/50">
                    {item.createTime && <span>{_t('created')}: {item.createTime}</span>}
                    {item.startTime && <span>{_t('started')}: {item.startTime}</span>}
                    {item.updateTime && <span>{_t('updated')}: {item.updateTime}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!isUser && msg.downloadUrl && (
          <a
            href={msg.downloadUrl}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-medium text-base-content shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {msg.downloadLabel || _t('downloadDiagnosticLog')}
          </a>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
