type LoggerLike = {
  debug?: (message: string, data?: unknown) => void;
};

type PopupInteractionOptions = {
  popup: HTMLElement;
  popupHeader: HTMLElement;
  floatingBall: HTMLElement;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  resizeThreshold: number;
  dragThreshold: number;
  logUi?: LoggerLike;
  onSizeChange?: (size: { width: number; height: number }) => void;
};

export default class PopupInteractionController {
  private popup: HTMLElement;
  private popupHeader: HTMLElement;
  private floatingBall: HTMLElement;
  private minWidth: number;
  private minHeight: number;
  private maxWidth: number;
  private maxHeight: number;
  private resizeThreshold: number;
  private dragThreshold: number;
  private logUi?: LoggerLike;
  private onSizeChange?: (size: { width: number; height: number }) => void;

  private isDragging = false;
  private dragTarget: HTMLElement | null = null;
  private dragStartPosition = { x: 0, y: 0 };
  private currentPosition = { left: 0, top: 0 };
  private lastMousePosition = { x: 0, y: 0 };
  private dragStarted = false;
  private hasDragged = false;
  private dragPrevTransition: string | null = null;

  private isResizing = false;
  private resizeKey: 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw' | null = null;
  private resizeStartPointer = { x: 0, y: 0 };
  private resizeStartRect = { left: 0, top: 0, width: 0, height: 0 };
  private resizeStarted = false;
  private resizeChanged = false;
  private resizeWasCentered = false;
  private resizePrevTransition: string | null = null;
  private prevUserSelect: string | null = null;
  private prevHtmlUserSelect: string | null = null;

  constructor(options: PopupInteractionOptions) {
    this.popup = options.popup;
    this.popupHeader = options.popupHeader;
    this.floatingBall = options.floatingBall;
    this.minWidth = options.minWidth;
    this.minHeight = options.minHeight;
    this.maxWidth = options.maxWidth;
    this.maxHeight = options.maxHeight;
    this.resizeThreshold = options.resizeThreshold;
    this.dragThreshold = options.dragThreshold;
    this.logUi = options.logUi;
    this.onSizeChange = options.onSizeChange;
  }

  public bind() {
    this.floatingBall.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.hasDragged) return;
      this.popup.dispatchEvent(new CustomEvent('poelink:toggle'));
    });

    this.popupHeader.querySelector('#close-popup')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.popup.dispatchEvent(new CustomEvent('poelink:close'));
    });

    this.makeDraggable(this.floatingBall);
    this.makeDraggable(this.popup, this.popupHeader);
    this.makeResizable();
  }

  public hasRecentDrag() {
    return this.hasDragged;
  }

  private logPopupState(action: string, extra: Record<string, unknown> = {}) {
    const rect = this.popup.getBoundingClientRect();
    const payload = {
      isDragging: this.isDragging,
      isResizing: this.isResizing,
      resizeKey: this.resizeKey,
      position: { left: rect.left, top: rect.top },
      size: { width: rect.width, height: rect.height },
      classes: this.popup.className,
      styles: {
        position: this.popup.style.position,
        left: this.popup.style.left,
        top: this.popup.style.top,
        right: this.popup.style.right,
        bottom: this.popup.style.bottom,
        transform: this.popup.style.transform,
        inset: this.popup.style.inset,
        margin: this.popup.style.margin,
      },
      ...extra,
    };
    this.logUi?.debug?.(action, payload);
    window.postMessage({ source: 'POELink', type: 'UI_LOG', action, payload }, '*');
  }

  private makeResizable() {
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
      if (!key) return;
      this.isResizing = true;
      this.resizeKey = key;
      this.resizeStarted = false;
      this.resizeChanged = false;
      this.resizeWasCentered = this.popup.classList.contains('top-1/2');
      this.resizeStartPointer = { x: e.clientX, y: e.clientY };
      const rect = this.popup.getBoundingClientRect();
      this.resizeStartRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      this.currentPosition = { left: rect.left, top: rect.top };
      this.resizePrevTransition = this.popup.style.transition;
      this.popup.style.transition = 'none';
      this.prevUserSelect = document.body.style.userSelect;
      this.prevHtmlUserSelect = document.documentElement.style.userSelect;
      document.body.style.userSelect = 'none';
      document.documentElement.style.userSelect = 'none';
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      this.logUi?.debug?.('resize-pointerdown', { x: e.clientX, y: e.clientY, key });
      this.logPopupState('resize-start', { pointer: { x: e.clientX, y: e.clientY }, key });
      e.preventDefault();
      e.stopPropagation();
    };

    const move = (e: PointerEvent) => {
      if (!this.isResizing || !this.resizeKey) return;
      e.preventDefault();

      const dx = e.clientX - this.resizeStartPointer.x;
      const dy = e.clientY - this.resizeStartPointer.y;

      if (!this.resizeStarted) {
        if (Math.abs(dx) < this.resizeThreshold && Math.abs(dy) < this.resizeThreshold) {
          return;
        }
        this.resizeStarted = true;
        const { left, top } = this.resizeStartRect;
        this.popup.style.position = 'fixed';
        this.popup.style.left = `${left}px`;
        this.popup.style.top = `${top}px`;
        this.popup.style.right = 'auto';
        this.popup.style.bottom = 'auto';
        this.popup.style.transform = 'none';
        this.popup.style.margin = '0';
        this.popup.classList.remove('top-1/2', 'left-1/2', '-translate-x-1/2', '-translate-y-1/2');
        this.logPopupState('resize-activate', { pointer: { x: e.clientX, y: e.clientY } });
      }

      let { left, top, width, height } = this.resizeStartRect;
      const viewportPadding = 8;
      const maxWidth = Math.min(this.maxWidth, window.innerWidth - viewportPadding * 2);
      const maxHeight = Math.min(this.maxHeight, window.innerHeight - viewportPadding * 2);

      const resizeNorth = this.resizeKey.includes('n');
      const resizeSouth = this.resizeKey.includes('s');
      const resizeWest = this.resizeKey.includes('w');
      const resizeEast = this.resizeKey.includes('e');

      if (resizeEast) {
        width = Math.min(maxWidth, Math.max(this.minWidth, this.resizeStartRect.width + dx));
      }
      if (resizeSouth) {
        height = Math.min(maxHeight, Math.max(this.minHeight, this.resizeStartRect.height + dy));
      }
      if (resizeWest) {
        const nextWidth = Math.min(maxWidth, Math.max(this.minWidth, this.resizeStartRect.width - dx));
        left = this.resizeStartRect.left + (this.resizeStartRect.width - nextWidth);
        width = nextWidth;
      }
      if (resizeNorth) {
        const nextHeight = Math.min(maxHeight, Math.max(this.minHeight, this.resizeStartRect.height - dy));
        top = this.resizeStartRect.top + (this.resizeStartRect.height - nextHeight);
        height = nextHeight;
      }

      left = Math.min(Math.max(viewportPadding, left), window.innerWidth - width - viewportPadding);
      top = Math.min(Math.max(viewportPadding, top), window.innerHeight - height - viewportPadding);

      if (!this.resizeChanged) {
        const changed =
          Math.round(left) !== Math.round(this.resizeStartRect.left) ||
          Math.round(top) !== Math.round(this.resizeStartRect.top) ||
          Math.round(width) !== Math.round(this.resizeStartRect.width) ||
          Math.round(height) !== Math.round(this.resizeStartRect.height);
        this.resizeChanged = changed;
      }

      this.onSizeChange?.({ width, height });
      this.currentPosition = { left, top };
      this.popup.style.width = `${width}px`;
      this.popup.style.height = `${height}px`;
      this.popup.style.left = `${left}px`;
      this.popup.style.top = `${top}px`;
      this.popup.style.right = 'auto';
      this.popup.style.bottom = 'auto';
      this.popup.style.transform = 'none';
      this.logPopupState('resize-move', { pointer: { x: e.clientX, y: e.clientY } });
    };

    const end = () => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.resizeKey = null;
      this.resizeStarted = false;
      if (!this.resizeChanged && this.resizeWasCentered) {
        this.popup.style.position = '';
        this.popup.style.left = '';
        this.popup.style.top = '';
        this.popup.style.right = '';
        this.popup.style.bottom = '';
        this.popup.style.inset = '';
        this.popup.style.transform = '';
        this.popup.style.margin = '';
        this.popup.classList.add('top-1/2', 'left-1/2', '-translate-x-1/2', '-translate-y-1/2');
      }
      this.resizeChanged = false;
      this.resizeWasCentered = false;
      this.logPopupState('resize-end');
      if (this.resizePrevTransition !== null) {
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
      if ((e.target as HTMLElement).closest('[data-resize]')) return;

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
      this.logUi?.debug?.('drag-pointerdown', { x: e.clientX, y: e.clientY });
      this.logPopupState('drag-start', { pointer: { x: e.clientX, y: e.clientY } });
      e.preventDefault();
      e.stopPropagation();
    };

    const move = (e: PointerEvent) => {
      if (!this.isDragging || !this.dragTarget) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (!this.dragStarted) {
        const deltaX = Math.abs(clientX - this.dragStartPosition.x);
        const deltaY = Math.abs(clientY - this.dragStartPosition.y);

        if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
          this.dragStarted = true;
          this.hasDragged = true;

          const rect = this.dragTarget.getBoundingClientRect();

          this.dragPrevTransition = this.dragTarget.style.transition;
          this.dragTarget.style.transition = 'none';
          document.body.style.cursor = 'grabbing';

          this.currentPosition = { left: rect.left, top: rect.top };

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

          this.lastMousePosition = { x: clientX, y: clientY };
        } else {
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();

      const deltaX = clientX - this.lastMousePosition.x;
      const deltaY = clientY - this.lastMousePosition.y;

      this.currentPosition.left += deltaX;
      this.currentPosition.top += deltaY;

      this.lastMousePosition = { x: clientX, y: clientY };

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

      this.dragTarget.style.left = `${this.currentPosition.left}px`;
      this.dragTarget.style.top = `${this.currentPosition.top}px`;
      this.logPopupState('drag-move', { pointer: { x: clientX, y: clientY } });
    };

    const end = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.logPopupState('drag-end');
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
}
