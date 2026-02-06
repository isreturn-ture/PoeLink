import { defineContentScript } from 'wxt/utils/define-content-script';
import ContentScript from './content/ContentScript';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    if (typeof window === 'undefined' || window.POELinkContentScript) return;

    const currentUrl = window.location.href.toLowerCase();
    const allowKeywords = ['ops', 'portal', 'rcs', 'wms'];
    const shouldShow = allowKeywords.some((keyword) => currentUrl.includes(keyword));
    if (!shouldShow) return;

    window.POELinkContentScript = new ContentScript(ctx);
  },
});

declare global {
  interface Window {
    POELinkContentScript?: ContentScript;
  }
}
