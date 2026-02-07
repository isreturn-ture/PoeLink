/**
 * i18n for entire application
 */

import { appLocales, type AppLocale, type AppI18nKey } from './locales/app';

export type { AppLocale, AppI18nKey } from './locales/app';

// Re-export config types for backward compatibility
export type ConfigLocale = AppLocale;
export type ConfigI18nKey = AppI18nKey;

export function createAppI18n(lang: AppLocale) {
  const t = (key: AppI18nKey, params?: Record<string, string | number>): string => {
    const dict = appLocales[lang] ?? appLocales['zh-CN'];
    let text = dict[key] ?? appLocales['zh-CN'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  };
  return { t };
}

// Backward compatibility - config i18n uses same app locales
export const createConfigI18n = createAppI18n;
