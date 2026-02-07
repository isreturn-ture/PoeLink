import { useLayoutEffect } from 'react';

import type { AppSettings } from '../entrypoints/popup/types';

/** 根据配置与系统偏好，将 data-theme 应用到 document.documentElement（Tailwind 主题切换），可导出供保存配置后立即应用 */
export function applyThemeToDocument(theme: AppSettings['theme'] | undefined, systemPrefersDark?: boolean) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (!el) return;

  const mode = theme || 'system';
  if (mode === 'light' || mode === 'dark') {
    el.setAttribute('data-theme', mode);
    el.classList.toggle('dark', mode === 'dark');
    return;
  }

  const isDark =
    typeof systemPrefersDark === 'boolean'
      ? systemPrefersDark
      : typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  el.setAttribute('data-theme', isDark ? 'dark' : 'light');
  el.classList.toggle('dark', !!isDark);
}

export function useThemeSetting(theme: AppSettings['theme'] | undefined) {
  // 使用 useLayoutEffect 在绘制前同步应用主题，避免切换时页面无变化
  useLayoutEffect(() => {
    const mode = theme ?? 'system';
    const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null;

    if (mode !== 'system' || !mq) {
      applyThemeToDocument(mode);
      return;
    }

    const handleChange = (e?: MediaQueryListEvent) => {
      applyThemeToDocument('system', e ? e.matches : mq.matches);
    };

    handleChange();
    mq.addEventListener?.('change', handleChange);
    return () => mq.removeEventListener?.('change', handleChange);
  }, [theme]);
}
