import React from 'react';

import BrandLogo from './BrandLogo';

const Header = ({
  title,
  subtitle,
  startAddon,
  onBack,
  onClose,
  showClose = true,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  startAddon?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  children?: React.ReactNode;
}) => (
  <header className="navbar bg-base-100 border-b border-base-300 shrink-0 px-4 py-3">
    <div className="navbar-start">
      <div className="flex items-center gap-3 w-full min-w-0">
        <BrandLogo className="shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-base-content truncate">{title}</h3>
          {subtitle && <p className="text-xs text-base-content/70">{subtitle}</p>}
        </div>
        {startAddon && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1 max-w-[55%]">{startAddon}</div>
        )}
      </div>
    </div>
    <div className="navbar-end gap-1">
      {children}
      {onBack && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square transition-all duration-200 hover:scale-110 active:scale-95"
          onClick={onBack}
          aria-label="返回"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {onClose && showClose && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 transition-all duration-200 hover:scale-110 active:scale-95"
          onClick={onClose}
          aria-label="关闭"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  </header>
);

export default Header;
