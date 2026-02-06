import { useCallback, useEffect, useRef, useState } from 'react';

export const useHistoryPanel = (animMs = 220) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMounted, setHistoryMounted] = useState(false);
  const historyUnmountTimerRef = useRef<number | null>(null);

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
    }, animMs);

    return () => {
      if (historyUnmountTimerRef.current != null) {
        window.clearTimeout(historyUnmountTimerRef.current);
        historyUnmountTimerRef.current = null;
      }
    };
  }, [historyOpen, historyMounted, animMs]);

  return {
    historyOpen,
    historyMounted,
    openHistory,
    closeHistory,
  };
};
