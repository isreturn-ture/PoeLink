import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import storageService, { type ChatSession as StoredChatSession } from '../entrypoints/popup/services/StorageService';
import type { Message } from '../entrypoints/popup/types';

type LoggerLike = {
  warn?: (message: string, ...args: unknown[]) => void;
};

export const useChatSessions = ({ closeHistory, log }: { closeHistory: () => void; log?: LoggerLike }) => {
  // 当前聊天消息、会话列表、激活会话
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    (async () => {
      const initResult = await storageService.initSessions();
      if (mounted) {
        setSessions(initResult.sessions);
        setActiveSessionId(initResult.activeSessionId);
        const activeSession = initResult.sessions.find(s => s && s.id === initResult.activeSessionId);
        setMessages(Array.isArray(activeSession?.messages) ? activeSession.messages : []);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, any>, areaName: string) => {
      if (areaName !== 'local') return;

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_messages')) {
        const nextMessages = changes.poelink_messages?.newValue as Message[] | undefined;
        if (Array.isArray(nextMessages)) setMessages(nextMessages);
        else if (nextMessages == null) setMessages([]);
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_sessions')) {
        const nextSessions = changes.poelink_sessions?.newValue as StoredChatSession[] | undefined;
        if (Array.isArray(nextSessions)) setSessions(nextSessions);
        else if (nextSessions == null) setSessions([]);
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'poelink_active_session_id')) {
        const nextActiveSessionId = changes.poelink_active_session_id?.newValue;
        if (typeof nextActiveSessionId === 'string') setActiveSessionId(nextActiveSessionId);
        else if (nextActiveSessionId == null) setActiveSessionId('');
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // 保存消息并同步最新会话列表
  const saveMessages = useCallback(async (nextMessages: Message[]) => {
    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const initResult = await storageService.initSessions();
        sessionId = initResult.activeSessionId;
        setSessions(initResult.sessions);
        setActiveSessionId(initResult.activeSessionId);
      }

      await storageService.updateSessionMessages(sessionId, nextMessages);
      const latestSessions = await storageService.getSessions();
      setSessions(latestSessions);
    } catch (err) {
      log?.warn?.('保存消息失败', err);
    }
  }, [activeSessionId, log]);

  // 清空聊天记录并重置会话
  const clearChatHistory = useCallback(async () => {
    try {
      await storageService.clearChatHistory();
      const initResult = await storageService.initSessions();
      setSessions(initResult.sessions);
      setActiveSessionId(initResult.activeSessionId);
      const activeSession = initResult.sessions.find(s => s && s.id === initResult.activeSessionId);
      setMessages(Array.isArray(activeSession?.messages) ? activeSession.messages : []);
    } catch (err) {
      log?.warn?.('清除聊天记录失败', err);
    }
  }, [log]);

  // 新建空会话并激活
  const createNewSession = useCallback(async () => {
    if (messages.length === 0) {
      closeHistory();
      return;
    }
    try {
      const session = await storageService.createSession([]);
      const latestSessions = await storageService.getSessions();
      setSessions(latestSessions);
      setActiveSessionId(session.id);
      setMessages([]);
      closeHistory();
    } catch (err) {
      log?.warn?.('创建会话失败', err);
    }
  }, [closeHistory, messages.length, log]);

  // 切换到指定会话
  const switchSession = useCallback(async (sessionId: string) => {
    try {
      const nextSession = await storageService.activateSession(sessionId);
      if (!nextSession) return;
      setActiveSessionId(nextSession.id);
      setMessages(Array.isArray(nextSession.messages) ? nextSession.messages : []);
      const latestSessions = await storageService.getSessions();
      setSessions(latestSessions);
      closeHistory();
    } catch (err) {
      log?.warn?.('切换会话失败', err);
    }
  }, [closeHistory, log]);

  return {
    messages,
    setMessages,
    sessions,
    activeSessionId,
    saveMessages,
    clearChatHistory,
    createNewSession,
    switchSession,
  };
};
