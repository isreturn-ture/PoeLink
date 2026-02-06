import { useEffect } from 'react';

import type { AppSettings } from '../entrypoints/popup/types';

// 根据配置与系统偏好应用主题
const applyThemeSetting = (theme: AppSettings['theme'] | undefined, systemPrefersDark?: boolean) => {
  if (typeof window === 'undefined') return;
  const documentElement = window.document?.documentElement;
  if (!documentElement) return;

  const themeMode = theme || 'system';
  if (themeMode === 'light' || themeMode === 'dark') {
    documentElement.setAttribute('data-theme', themeMode);
    documentElement.classList.toggle('dark', themeMode === 'dark');
    return;
  }

  const isDark = typeof systemPrefersDark === 'boolean'
    ? systemPrefersDark
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  documentElement.classList.toggle('dark', !!isDark);
};

export const useThemeSetting = (theme: AppSettings['theme'] | undefined) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const themeMode = theme ?? 'system';
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    if (themeMode !== 'system' || !mediaQuery) {
      // 非系统模式或缺少媒体查询时直接应用
      applyThemeSetting(themeMode);
      return;
    }

    const handleSchemeChange = (event?: MediaQueryListEvent) => {
      applyThemeSetting('system', event ? event.matches : mediaQuery.matches);
    };

    // 初始化并监听系统主题变化
    handleSchemeChange();
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handleSchemeChange);
    else (mediaQuery as any).addListener(handleSchemeChange);

    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', handleSchemeChange);
      else (mediaQuery as any).removeListener(handleSchemeChange);
    };
  }, [theme]);
};
