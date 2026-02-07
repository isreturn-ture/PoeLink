import React from 'react';

import BrandLogo from './BrandLogo';

const Header = ({
  title,
  subtitle,
  startAddon,
  onBack,
  onClose,
  showClose = true,
  backAriaLabel = '返回',
  closeAriaLabel = '关闭',
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  startAddon?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  backAriaLabel?: string;
  closeAriaLabel?: string;
  children?: React.ReactNode;
}) => (
  <header className="navbar bg-base-100 border-b border-base-300 shrink-0 px-3 sm:px-4 py-2 sm:py-2.5">
    <div className="navbar-start min-w-0">
      <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
        <BrandLogo className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base-content truncate text-sm sm:text-[15px] tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] sm:text-xs text-base-content/70 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        {startAddon && (
          <div className="hidden sm:flex flex-wrap items-center justify-end gap-1.5 max-w-[50%] shrink-0">{startAddon}</div>
        )}
      </div>
    </div>
    <div className="navbar-end gap-0.5 sm:gap-1 shrink-0">
      {children}
      {onBack && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square min-w-9 min-h-9 w-9 h-9 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-80 cursor-pointer"
          onClick={onBack}
          aria-label={backAriaLabel}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {onClose && showClose && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square min-w-9 min-h-9 w-9 h-9 rounded-lg text-error hover:bg-error/10 focus-visible:ring-2 focus-visible:ring-error/30 focus-visible:ring-offset-2 transition-colors duration-200 hover:opacity-90 cursor-pointer"
          onClick={onClose}
          aria-label={closeAriaLabel}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  </header>
);

export default Header;
