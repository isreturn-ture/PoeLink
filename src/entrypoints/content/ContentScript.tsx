import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import React from 'react';
import ReactDOM from 'react-dom/client';
import MainApp from '../popup/MainApp';
import DisclaimerModal from '../../components/popup/DisclaimerModal';
import storageService from '../popup/services/StorageService';
import '../popup/tailwind.css';
import { createLogger } from '../../utils/logger';
import PopupInteractionController from '../../components/content/PopupInteractionController';

const logUi = createLogger('content-ui', {
  serialize: { depth: 4, maxKeys: 40, maxArrayLength: 40 },
});

export default class ContentScript {
  private ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private disclaimerUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private isPopupVisible = false;
  private floatingBall: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private popupHeader: HTMLElement | null = null;
  private reactRoot: ReactDOM.Root | null = null;
  private disclaimerRoot: ReactDOM.Root | null = null;
  private uiContainer: HTMLElement | null = null;
  private disclaimerContainer: HTMLElement | null = null;
  private ctx: any;
  private interactionController: PopupInteractionController | null = null;
  private disclaimerAgreed = false;
  // 防止悬浮球点击导致的 poelink:toggle 事件重复触发两次 togglePopup
  private suppressNextToggleEvent = false;

  // 尺寸与缩放（与 usePopupSizing 保持一致）
  private popupWidth = Math.min(window.innerWidth * 0.95, 760);
  private popupHeight = Math.min(window.innerHeight * 0.9, 620);
  private readonly MIN_WIDTH = 320;
  private readonly MIN_HEIGHT = 280;
  private readonly MAX_WIDTH = 1200;
  private readonly MAX_HEIGHT = 900;
  private readonly RESIZE_THRESHOLD = 2;
  /** 缩放到小于此尺寸时自动收起为悬浮球 */
  private readonly COLLAPSE_WIDTH = 480;
  private readonly COLLAPSE_HEIGHT = 420;

  constructor(ctx: any) {
    this.ctx = ctx;
    this.initialize();
  }

  private async initialize() {
    this.bindMessageListeners();
    await this.checkDisclaimerState();
    await this.createUI();
    logUi.info('内容脚本已初始化');
  }

  private async checkDisclaimerState() {
    // 检查免责声明状态
    const state = await storageService.getDisclaimerState();
    this.disclaimerAgreed = state?.agreed === true;
  }

  private bindMessageListeners() {
    browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.type === 'TOGGLE_FLOATING') {
        this.togglePopup();
        sendResponse({ success: true });
      }
      return true;
    });

    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'POELink' || data.type !== 'SET_UI_SIZE') return;
      if (!this.popup) return;
      const width = Number(data.width);
      const height = Number(data.height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      this.popupWidth = width;
      this.popupHeight = height;
      this.popup.style.width = `${width}px`;
      this.popup.style.height = `${height}px`;
    });
  }

  private async createUI() {
    this.ui = await createShadowRootUi(this.ctx, {
      name: 'poelink-floating-ui',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: true,
      onMount: (container) => {
        this.uiContainer = container;
        container.setAttribute('data-theme', 'corporate');
        container.style.pointerEvents = 'none';
        container.style.position = 'absolute';
        container.style.width = '0';
        container.style.height = '0';
        container.style.overflow = 'visible';
        container.style.zIndex = '2147483647';
        container.className = 'all-unset';

        this.floatingBall = document.createElement('div');
        this.floatingBall.className = `
          pointer-events-auto fixed bottom-6 right-6 w-14 h-14 rounded-full
          bg-primary text-white shadow-xl flex items-center justify-center
          cursor-pointer select-none transition-all duration-300 ease-out
          hover:scale-110 hover:shadow-2xl active:scale-95
        `;

        this.floatingBall.style.zIndex = '999999';

        this.floatingBall.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        `;

        this.floatingBall.addEventListener('click', () => this.handleFloatingBallClick());
        container.appendChild(this.floatingBall);

        return container;
      },
      onRemove: () => {
        this.cleanup();
      },
    });

    this.ui.mount();
  }

  private handleFloatingBallClick() {
    logUi.debug('悬浮球被点击', { disclaimerAgreed: this.disclaimerAgreed, isPopupVisible: this.isPopupVisible });
    // 如果未同意免责声明，显示免责声明弹窗
    if (!this.disclaimerAgreed) {
      this.showDisclaimerModal();
      return;
    }
    // 否则切换主弹窗
    // 由于 PopupInteractionController 也会在悬浮球点击时派发一次 poelink:toggle，
    // 这里提前标记，避免 togglePopup 被调用两次导致“开关抵消”。
    this.suppressNextToggleEvent = true;
    this.togglePopup();
  }

  private async showDisclaimerModal() {
    if (this.disclaimerUi) return; // 已经显示

    this.disclaimerUi = await createShadowRootUi(this.ctx, {
      name: 'poelink-disclaimer-ui',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: true,
      onMount: (container) => {
        this.disclaimerContainer = container;
        container.setAttribute('data-theme', 'corporate');
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.zIndex = '2147483648'; // 比主弹窗更高
        container.className = 'all-unset';

        const disclaimerWrapper = document.createElement('div');
        disclaimerWrapper.className = 'w-full h-full';
        container.appendChild(disclaimerWrapper);

        this.disclaimerRoot = ReactDOM.createRoot(disclaimerWrapper);
        this.disclaimerRoot.render(
          <React.StrictMode>
            <DisclaimerModal
              allowDontShowAgain={false}
              defaultDontShowAgain={false}
              onAgree={async ({ dontShowAgain }) => {
                await storageService.setDisclaimerState({ agreed: true, dontShowAgain });
                this.disclaimerAgreed = true;
                this.hideDisclaimerModal();
                logUi.info('用户同意免责声明');
              }}
              onCancel={async () => {
                await storageService.setDisclaimerState({ agreed: false, dontShowAgain: false });
                this.disclaimerAgreed = false;
                this.hideDisclaimerModal();
                logUi.info('用户取消免责声明');
              }}
            />
          </React.StrictMode>
        );

        return container;
      },
      onRemove: () => {
        if (this.disclaimerRoot) {
          this.disclaimerRoot.unmount();
          this.disclaimerRoot = null;
        }
        this.disclaimerContainer = null;
      },
    });

    this.disclaimerUi.mount();
  }

  private hideDisclaimerModal() {
    if (this.disclaimerUi) {
      this.disclaimerUi.remove();
      this.disclaimerUi = null;
    }
    if (this.disclaimerRoot) {
      this.disclaimerRoot.unmount();
      this.disclaimerRoot = null;
    }
    this.disclaimerContainer = null;
  }

  private ensurePopup() {
    logUi.debug('ensurePopup 被调用', { hasPopup: !!this.popup, hasContainer: !!this.uiContainer });
    if (this.popup || !this.uiContainer) return;

    const container = this.uiContainer;

    this.popup = document.createElement('div');
    this.popup.className = `
          pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          bg-base-100 text-base-content rounded-2xl shadow-2xl border border-base-300 flex flex-col overflow-hidden
          opacity-0 scale-95 transition-all duration-300 ease-out
          will-change-transform
        `;
    this.popup.style.zIndex = '999998';
    this.popup.style.width = `${this.popupWidth}px`;
    this.popup.style.height = `${this.popupHeight}px`;
    this.popup.style.minWidth = `${this.MIN_WIDTH}px`;
    this.popup.style.minHeight = `${this.MIN_HEIGHT}px`;
    this.popup.style.touchAction = 'none';

    this.popupHeader = document.createElement('div');
    this.popupHeader.className = `
          flex items-center justify-between bg-base-100 border-b border-base-300 px-4 py-3
          shrink-0 cursor-move select-none
        `;
    this.popupHeader.innerHTML = `
          <div class="flex items-center">
            <h3 class="text-base font-semibold text-base-content">PoeLink</h3>
          </div>
          <div class="flex items-center">
            <button id="close-popup" class="h-8 w-8 inline-flex items-center justify-center rounded-md text-base-content/70 transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-base-200 hover:text-base-content" aria-label="关闭">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;

    const content = document.createElement('div');
    content.className = 'flex-1 min-h-0 overflow-hidden flex flex-col';
    const appRoot = document.createElement('div');
    appRoot.className = 'flex-1 min-h-0 w-full h-full bg-base-100 text-base-content';
    content.appendChild(appRoot);

    this.popup.appendChild(this.popupHeader);
    this.popup.appendChild(content);

    // 伸缩把手：供 PopupInteractionController 绑定拖拽缩放
    const resizeHandles = [
      { key: 'n', style: 'top:0;left:0;right:0;height:6px;cursor:n-resize' },
      { key: 's', style: 'bottom:0;left:0;right:0;height:6px;cursor:s-resize' },
      { key: 'e', style: 'top:0;right:0;bottom:0;width:6px;cursor:e-resize' },
      { key: 'w', style: 'top:0;left:0;bottom:0;width:6px;cursor:w-resize' },
      { key: 'ne', style: 'top:0;right:0;width:10px;height:10px;cursor:ne-resize' },
      { key: 'nw', style: 'top:0;left:0;width:10px;height:10px;cursor:nw-resize' },
      { key: 'se', style: 'bottom:0;right:0;width:10px;height:10px;cursor:se-resize' },
      { key: 'sw', style: 'bottom:0;left:0;width:10px;height:10px;cursor:sw-resize' },
    ];
    resizeHandles.forEach(({ key, style }) => {
      const handle = document.createElement('div');
      handle.setAttribute('data-resize', key);
      handle.setAttribute('aria-hidden', 'true');
      handle.style.cssText = `position:absolute;${style};z-index:10;pointer-events:auto;`;
      this.popup.appendChild(handle);
    });

    container.appendChild(this.popup);

    this.reactRoot?.unmount();
    this.reactRoot = ReactDOM.createRoot(appRoot);
    this.reactRoot.render(
      <React.StrictMode>
        <MainApp onClose={() => this.teardownPopup()} showCloseInHeader={false} />
      </React.StrictMode>
    );

    this.bindEvents();
  }

  private teardownPopup() {
    logUi.debug('teardownPopup 被调用', { hasPopup: !!this.popup, hasFloatingBall: !!this.floatingBall });
    if (!this.floatingBall) return;

    this.interactionController?.unbind();
    this.interactionController = null;

    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }

    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
    this.popupHeader = null;

    this.floatingBall.classList.remove('opacity-0', 'pointer-events-none', 'scale-90');
    this.isPopupVisible = false;
    
    logUi.info('弹窗已销毁，状态已重置');
  }

  private bindEvents() {
    if (!this.floatingBall || !this.popup || !this.popupHeader) return;

    this.popup.addEventListener('poelink:toggle', () => {
      // 如果是刚刚由悬浮球点击触发的 toggle，则忽略这次事件，避免二次切换
      if (this.suppressNextToggleEvent) {
        this.suppressNextToggleEvent = false;
        return;
      }
      this.togglePopup();
    });
    this.popup.addEventListener('poelink:close', () => this.hidePopup());

    this.interactionController = new PopupInteractionController({
      popup: this.popup,
      popupHeader: this.popupHeader,
      floatingBall: this.floatingBall,
      minWidth: this.MIN_WIDTH,
      minHeight: this.MIN_HEIGHT,
      maxWidth: this.MAX_WIDTH,
      maxHeight: this.MAX_HEIGHT,
      resizeThreshold: this.RESIZE_THRESHOLD,
      dragThreshold: 5,
      collapseThreshold: { width: this.COLLAPSE_WIDTH, height: this.COLLAPSE_HEIGHT },
      logUi,
      onSizeChange: ({ width, height }) => {
        this.popupWidth = width;
        this.popupHeight = height;
      },
      onCollapseRequest: () => this.collapsePopupToBall(),
    });
    this.interactionController.bind();
  }

  /** 弹窗缩小到阈值时：播放收缩到悬浮球的动效，然后关闭弹窗 */
  private collapsePopupToBall() {
    if (!this.popup || !this.floatingBall) return;

    this.popup.style.pointerEvents = 'none';
    const popupRect = this.popup.getBoundingClientRect();
    const ballRect = this.floatingBall.getBoundingClientRect();
    const popupCenterX = popupRect.left + popupRect.width / 2;
    const popupCenterY = popupRect.top + popupRect.height / 2;
    const ballCenterX = ballRect.left + ballRect.width / 2;
    const ballCenterY = ballRect.top + ballRect.height / 2;
    const dx = ballCenterX - popupCenterX;
    const dy = ballCenterY - popupCenterY;

    const durationMs = 320;
    this.popup.style.transition = `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`;
    this.popup.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
    this.popup.style.opacity = '0';

    this.floatingBall.classList.remove('opacity-0', 'pointer-events-none', 'scale-90');
    this.floatingBall.style.transition = 'transform 0.25s ease-out';
    this.floatingBall.style.transform = 'scale(0.6)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.floatingBall.style.transform = 'scale(1)';
      });
    });

    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      this.popup.removeEventListener('transitionend', onEnd);
      if (!this.popup) return;
      this.popup.style.transition = '';
      this.popup.style.transform = '';
      this.popup.style.opacity = '';
      this.popup.style.pointerEvents = '';
      if (this.floatingBall) {
        this.floatingBall.style.transition = '';
        this.floatingBall.style.transform = '';
      }
      this.hidePopup();
      this.isPopupVisible = false;
      logUi.info('弹窗已收缩为悬浮球');
    };
    this.popup.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, durationMs + 80);
  }

  private togglePopup() {
    this.isPopupVisible ? this.hidePopup() : this.showPopup();
  }

  private showPopup() {
    logUi.debug('showPopup 被调用', { hasFloatingBall: !!this.floatingBall });
    if (!this.floatingBall) return;
    this.ensurePopup();
    logUi.debug('ensurePopup 完成后', { hasPopup: !!this.popup });
    if (!this.popup) return;

    this.floatingBall.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
    this.popup.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
    this.popup.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    this.isPopupVisible = true;
    logUi.info('弹窗已显示');
  }

  private hidePopup() {
    if (!this.popup || !this.floatingBall) return;

    this.popup.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
    this.popup.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
    this.floatingBall.classList.remove('opacity-0', 'pointer-events-none', 'scale-90');
    this.isPopupVisible = false;
  }

  private cleanup() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }

    if (this.disclaimerRoot) {
      this.disclaimerRoot.unmount();
      this.disclaimerRoot = null;
    }

    this.uiContainer = null;
    this.disclaimerContainer = null;
    logUi.info('UI 已清理');
  }

  public destroy() {
    this.ui?.remove();
    this.disclaimerUi?.remove();
    this.cleanup();
    this.ui = null;
    this.disclaimerUi = null;
    this.floatingBall = null;
    this.popup = null;
    this.popupHeader = null;
    this.interactionController?.unbind();
    this.interactionController = null;
  }
}
