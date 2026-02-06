import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../popup/App';
import '../popup/tailwind.css';
import { createLogger } from '../../utils/logger';
import PopupInteractionController from '../../components/content/PopupInteractionController';

const logUi = createLogger('content-ui', {
  serialize: { depth: 4, maxKeys: 40, maxArrayLength: 40 },
});

export default class ContentScript {
  private ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private isPopupVisible = false;
  private floatingBall: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private popupHeader: HTMLElement | null = null;
  private reactRoot: ReactDOM.Root | null = null;
  private ctx: any;
  private interactionController: PopupInteractionController | null = null;

  // 尺寸与缩放
  private popupWidth = Math.min(window.innerWidth * 0.95, 720);
  private popupHeight = Math.min(window.innerHeight * 0.85, 520);
  private readonly MIN_WIDTH = 320;
  private readonly MIN_HEIGHT = 280;
  private readonly MAX_WIDTH = 1200;
  private readonly MAX_HEIGHT = 900;
  private readonly RESIZE_THRESHOLD = 2;

  constructor(ctx: any) {
    this.ctx = ctx;
    this.initialize();
  }

  private async initialize() {
    this.bindMessageListeners();
    await this.createUI();
    logUi.info('内容脚本已初始化');
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

        container.appendChild(this.floatingBall);
        container.appendChild(this.popup);

        this.reactRoot = ReactDOM.createRoot(appRoot);
        this.reactRoot.render(
          <React.StrictMode>
            <App onClose={() => this.hidePopup()} showCloseInHeader={false} />
          </React.StrictMode>
        );

        this.bindEvents();

        return container;
      },
      onRemove: () => {
        this.cleanup();
      },
    });

    this.ui.mount();
  }

  private bindEvents() {
    if (!this.floatingBall || !this.popup || !this.popupHeader) return;

    this.popup.addEventListener('poelink:toggle', () => this.togglePopup());
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
      logUi,
      onSizeChange: ({ width, height }) => {
        this.popupWidth = width;
        this.popupHeight = height;
      },
    });
    this.interactionController.bind();
  }

  private togglePopup() {
    this.isPopupVisible ? this.hidePopup() : this.showPopup();
  }

  private showPopup() {
    if (!this.popup || !this.floatingBall) return;

    this.floatingBall.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
    this.popup.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
    this.popup.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    this.isPopupVisible = true;
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
    logUi.info('UI 已清理');
  }

  public destroy() {
    this.ui?.remove();
    this.cleanup();
    this.ui = null;
    this.floatingBall = null;
    this.popup = null;
    this.popupHeader = null;
    this.interactionController = null;
  }
}
