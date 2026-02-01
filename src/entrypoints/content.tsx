import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './popup/App';
import './popup/tailwind.css';

class ContentScript {
  private ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private isPopupVisible = false;
  private floatingBall: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private popupHeader: HTMLElement | null = null;
  private reactRoot: ReactDOM.Root | null = null;
  private ctx: any;

  // 拖拽状态
  private isDragging = false;
  private dragTarget: HTMLElement | null = null;
  private dragStartPosition = { x: 0, y: 0 };
  private currentPosition = { left: 0, top: 0 };
  private lastMousePosition = { x: 0, y: 0 };
  private dragStarted = false;
  private hasDragged = false;
  private readonly DRAG_THRESHOLD = 5;

  // 尺寸与缩放
  private popupWidth = Math.min(window.innerWidth * 0.95, 720);
  private popupHeight = Math.min(window.innerHeight * 0.8, 420);
  private readonly MIN_WIDTH = 320;
  private readonly MIN_HEIGHT = 280;
  private readonly MAX_WIDTH = 1200;
  private readonly MAX_HEIGHT = 900;

  // 缩放状态
  private isResizing = false;
  private resizeKey: 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw' | null = null;
  private resizeStartPointer = { x: 0, y: 0 };
  private resizeStartRect = { left: 0, top: 0, width: 0, height: 0 };
  private resizePrevTransition: string | null = null;
  private prevUserSelect: string | null = null;
  private prevHtmlUserSelect: string | null = null;

  // 过渡状态
  private dragPrevTransition: string | null = null;

  constructor(ctx: any) {
    this.ctx = ctx;
    this.initialize();
  }

  private async initialize() {
    this.bindMessageListeners();
    await this.createUI();
    console.log('POELink 内容脚本已初始化');
  }

  private bindMessageListeners() {
    browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.type === 'TOGGLE_FLOATING') {
        this.togglePopup();
        sendResponse({ success: true });
      }
      return true;
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
        container.setAttribute('data-theme', 'corporate'); // DaisyUI 主题
        container.style.pointerEvents = 'none';
        container.style.position = 'absolute';
        container.style.width = '0';
        container.style.height = '0';
        container.style.overflow = 'visible'; // 允许内容溢出
        container.style.zIndex = '2147483647'; // 最大 Z-Index
        container.className = 'all-unset';

        // 浮动球 - daisyUI btn circle
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

        // 弹窗容器 - daisyUI card 风格
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

        // 弹窗头部 - daisyUI navbar
        this.popupHeader = document.createElement('div');
        this.popupHeader.className = `
          flex items-center justify-between bg-base-100 border-b border-base-300 px-4 py-3
          shrink-0 cursor-move select-none
        `;
        this.popupHeader.innerHTML = `
          <div class="flex items-center">
            <h3 class="text-base font-semibold text-base-content">PoeLInk</h3>
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

        // 内容区域
        const content = document.createElement('div');
        content.className = 'flex-1 min-h-0 overflow-hidden flex flex-col';
        const appRoot = document.createElement('div');
        appRoot.className = 'flex-1 min-h-0 w-full h-full bg-base-100 text-base-content';
        content.appendChild(appRoot);

        this.popup.appendChild(this.popupHeader);
        this.popup.appendChild(content);

        // 缩放手柄（边 + 角）
        const createHandle = (
          key: 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw',
          style: Partial<CSSStyleDeclaration>
        ) => {
          const handle = document.createElement('div');
          handle.setAttribute('data-resize', key);
          handle.style.position = 'absolute';
          handle.style.pointerEvents = 'auto';
          handle.style.touchAction = 'none';
          Object.assign(handle.style, style);
          return handle;
        };

        const edgeSize = '8px';
        const cornerSize = '10px';

        this.popup.appendChild(
          createHandle('n', { left: '0', top: '-4px', width: '100%', height: edgeSize, cursor: 'n-resize' })
        );
        this.popup.appendChild(
          createHandle('e', { top: '0', right: '-4px', width: edgeSize, height: '100%', cursor: 'e-resize' })
        );
        this.popup.appendChild(
          createHandle('s', { left: '0', bottom: '-4px', width: '100%', height: edgeSize, cursor: 's-resize' })
        );
        this.popup.appendChild(
          createHandle('w', { top: '0', left: '-4px', width: edgeSize, height: '100%', cursor: 'w-resize' })
        );
        this.popup.appendChild(
          createHandle('ne', { top: '-4px', right: '-4px', width: cornerSize, height: cornerSize, cursor: 'ne-resize' })
        );
        this.popup.appendChild(
          createHandle('se', { bottom: '-4px', right: '-4px', width: cornerSize, height: cornerSize, cursor: 'se-resize' })
        );
        this.popup.appendChild(
          createHandle('sw', { bottom: '-4px', left: '-4px', width: cornerSize, height: cornerSize, cursor: 'sw-resize' })
        );
        this.popup.appendChild(
          createHandle('nw', { top: '-4px', left: '-4px', width: cornerSize, height: cornerSize, cursor: 'nw-resize' })
        );

        container.appendChild(this.floatingBall);
        container.appendChild(this.popup);

        // 渲染 React 应用
        this.reactRoot = ReactDOM.createRoot(appRoot);
        this.reactRoot.render(
          <React.StrictMode>
            <App 
              onClose={() => this.hidePopup()} 
              showCloseInHeader={false}
            />
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

    // 浮动球点击事件
    this.floatingBall.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.hasDragged) {
        this.togglePopup();
      }
    });

    // 关闭按钮
    this.popupHeader.querySelector('#close-popup')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePopup();
    });

    // 拖拽
    this.makeDraggable(this.floatingBall);
    this.makeDraggable(this.popup, this.popupHeader);

    // 缩放
    this.makeResizable();

  }

  private makeResizable() {
    if (!this.popup) return;
    const handles = this.popup.querySelectorAll('[data-resize]');

    const start = (e: PointerEvent) => {
      const key = (e.currentTarget as HTMLElement).getAttribute('data-resize') as
        | 'n'
        | 'e'
        | 's'
        | 'w'
        | 'ne'
        | 'se'
        | 'sw'
        | 'nw'
        | null;
      if (!key || !this.popup) return;
      this.isResizing = true;
      this.resizeKey = key;
      this.resizeStartPointer = { x: e.clientX, y: e.clientY };
      const rect = this.popup.getBoundingClientRect();
      this.resizeStartRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      this.currentPosition = { left: rect.left, top: rect.top };
      this.resizePrevTransition = this.popup.style.transition;
      this.popup.style.transition = 'none';
      this.popup.style.left = `${rect.left}px`;
      this.popup.style.top = `${rect.top}px`;
      this.popup.style.right = 'auto';
      this.popup.style.bottom = 'auto';
      this.popup.style.transform = 'none';
      this.prevUserSelect = document.body.style.userSelect;
      this.prevHtmlUserSelect = document.documentElement.style.userSelect;
      document.body.style.userSelect = 'none';
      document.documentElement.style.userSelect = 'none';
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };

    const move = (e: PointerEvent) => {
      if (!this.isResizing || !this.resizeKey || !this.popup) return;
      e.preventDefault();

      const dx = e.clientX - this.resizeStartPointer.x;
      const dy = e.clientY - this.resizeStartPointer.y;

      let { left, top, width, height } = this.resizeStartRect;
      const viewportPadding = 8;
      const maxWidth = Math.min(this.MAX_WIDTH, window.innerWidth - viewportPadding * 2);
      const maxHeight = Math.min(this.MAX_HEIGHT, window.innerHeight - viewportPadding * 2);

      const resizeNorth = this.resizeKey.includes('n');
      const resizeSouth = this.resizeKey.includes('s');
      const resizeWest = this.resizeKey.includes('w');
      const resizeEast = this.resizeKey.includes('e');

      if (resizeEast) {
        width = Math.min(maxWidth, Math.max(this.MIN_WIDTH, this.resizeStartRect.width + dx));
      }
      if (resizeSouth) {
        height = Math.min(maxHeight, Math.max(this.MIN_HEIGHT, this.resizeStartRect.height + dy));
      }
      if (resizeWest) {
        const nextWidth = Math.min(maxWidth, Math.max(this.MIN_WIDTH, this.resizeStartRect.width - dx));
        left = this.resizeStartRect.left + (this.resizeStartRect.width - nextWidth);
        width = nextWidth;
      }
      if (resizeNorth) {
        const nextHeight = Math.min(maxHeight, Math.max(this.MIN_HEIGHT, this.resizeStartRect.height - dy));
        top = this.resizeStartRect.top + (this.resizeStartRect.height - nextHeight);
        height = nextHeight;
      }

      left = Math.min(Math.max(viewportPadding, left), window.innerWidth - width - viewportPadding);
      top = Math.min(Math.max(viewportPadding, top), window.innerHeight - height - viewportPadding);

      this.popupWidth = width;
      this.popupHeight = height;
      this.currentPosition = { left, top };
      this.popup.style.width = `${width}px`;
      this.popup.style.height = `${height}px`;
      this.popup.style.left = `${left}px`;
      this.popup.style.top = `${top}px`;
      this.popup.style.right = 'auto';
      this.popup.style.bottom = 'auto';
      this.popup.style.transform = 'none';
    };

    const end = () => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.resizeKey = null;
      if (this.popup && this.resizePrevTransition !== null) {
        this.popup.style.transition = this.resizePrevTransition;
        this.resizePrevTransition = null;
      }
      if (this.prevUserSelect !== null) {
        document.body.style.userSelect = this.prevUserSelect;
        this.prevUserSelect = null;
      }
      if (this.prevHtmlUserSelect !== null) {
        document.documentElement.style.userSelect = this.prevHtmlUserSelect;
        this.prevHtmlUserSelect = null;
      }
    };

    handles.forEach((handle) => {
      (handle as HTMLElement).addEventListener('pointerdown', start as EventListener);
    });
    document.addEventListener('pointermove', move as EventListener);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  }

  private makeDraggable(element: HTMLElement, handle = element) {
    const start = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if ((e.target as HTMLElement).closest('[data-resize]')) return; // 忽略缩放手柄

      this.isDragging = true;
      this.hasDragged = false;
      this.dragStarted = false;
      this.dragTarget = element;

      const clientX = e.clientX;
      const clientY = e.clientY;
      
      this.dragStartPosition = { x: clientX, y: clientY };
      this.lastMousePosition = { x: clientX, y: clientY };
      this.prevUserSelect = document.body.style.userSelect;
      this.prevHtmlUserSelect = document.documentElement.style.userSelect;
      document.body.style.userSelect = 'none';
      document.documentElement.style.userSelect = 'none';
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };

    const move = (e: PointerEvent) => {
      if (!this.isDragging || !this.dragTarget) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      // 拖拽阈值判断
      if (!this.dragStarted) {
        const deltaX = Math.abs(clientX - this.dragStartPosition.x);
        const deltaY = Math.abs(clientY - this.dragStartPosition.y);
        
        if (deltaX > this.DRAG_THRESHOLD || deltaY > this.DRAG_THRESHOLD) {
          this.dragStarted = true;
          this.hasDragged = true;

          // 初始化拖拽：获取当前元素的位置，并转换为 fixed 定位
          const rect = this.dragTarget.getBoundingClientRect();
          
          // 更新样式状态
          this.dragPrevTransition = this.dragTarget.style.transition;
          this.dragTarget.style.transition = 'none';
          document.body.style.cursor = 'grabbing';
          
          // 记录初始位置（基于视口）
          this.currentPosition = { left: rect.left, top: rect.top };
          
          // 应用 fixed 定位，移除 transform 等可能导致位移的属性
          this.dragTarget.style.position = 'fixed';
          this.dragTarget.style.width = `${rect.width}px`;
          this.dragTarget.style.height = `${rect.height}px`;
          this.dragTarget.style.left = `${this.currentPosition.left}px`;
          this.dragTarget.style.top = `${this.currentPosition.top}px`;
          this.dragTarget.style.right = 'auto';
          this.dragTarget.style.bottom = 'auto';
          this.dragTarget.style.inset = 'auto';
          this.dragTarget.style.margin = '0';
          this.dragTarget.style.transform = 'none';
          this.dragTarget.classList.remove('top-1/2', 'left-1/2', '-translate-x-1/2', '-translate-y-1/2');
          
          // 重置 lastMousePosition 为当前位置，确保后续计算 delta 准确
          this.lastMousePosition = { x: clientX, y: clientY };
        } else {
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();

      // 计算鼠标移动的差值 (Delta)
      const deltaX = clientX - this.lastMousePosition.x;
      const deltaY = clientY - this.lastMousePosition.y;

      // 更新当前位置
      this.currentPosition.left += deltaX;
      this.currentPosition.top += deltaY;

      // 更新上一次鼠标位置
      this.lastMousePosition = { x: clientX, y: clientY };

      // 边界限制：不允许拖出可视窗口
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;
      const rect = this.dragTarget.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (this.currentPosition.left < 0) {
        this.currentPosition.left = 0;
      }
      if (this.currentPosition.left + width > winWidth) {
        this.currentPosition.left = winWidth - width;
      }
      if (this.currentPosition.top < 0) {
        this.currentPosition.top = 0;
      }
      if (this.currentPosition.top + height > winHeight) {
        this.currentPosition.top = winHeight - height;
      }

      // 应用新位置
      this.dragTarget.style.left = `${this.currentPosition.left}px`;
      this.dragTarget.style.top = `${this.currentPosition.top}px`;
    };

    const end = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.dragTarget && this.dragPrevTransition !== null) {
        this.dragTarget.style.transition = this.dragPrevTransition;
        this.dragPrevTransition = null;
      }
      document.body.style.cursor = '';
      this.dragTarget = null;

      if (this.hasDragged) {
        window.setTimeout(() => {
          this.hasDragged = false;
        }, 0);
      }

      if (this.prevUserSelect !== null) {
        document.body.style.userSelect = this.prevUserSelect;
        this.prevUserSelect = null;
      }
      if (this.prevHtmlUserSelect !== null) {
        document.documentElement.style.userSelect = this.prevHtmlUserSelect;
        this.prevHtmlUserSelect = null;
      }
    };

    handle.addEventListener('pointerdown', start as EventListener);
    document.addEventListener('pointermove', move as EventListener);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
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
    console.log('POELink UI 已清理');
  }

  public destroy() {
    this.ui?.remove();
    this.cleanup();
    this.ui = null;
    this.floatingBall = null;
    this.popup = null;
    this.popupHeader = null;
  }
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    if (typeof window !== 'undefined' && !window.POELinkContentScript) {
      window.POELinkContentScript = new ContentScript(ctx);
    }
  },
});

declare global {
  interface Window {
    POELinkContentScript?: ContentScript;
  }
}
