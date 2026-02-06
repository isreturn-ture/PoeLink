import React from 'react';

import BrandLogo from '../../../components/popup/BrandLogo';

const WelcomeView = ({ onStartConfig }: { onStartConfig: () => void }) => {
  return (
    <div className="hero h-full min-h-0 !min-h-0 bg-base-200 animate-fade-in-up">
      <div className="hero-content flex-col py-8">
        <BrandLogo size="lg" className="mb-6" />
        <h1 className="text-2xl font-bold text-base-content">PoeLink</h1>
        <p className="text-base-content/70 text-sm text-center mb-8">AMR 问题排查助手</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            type="button"
            className="btn btn-primary flex-1 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            onClick={onStartConfig}
          >
            开始配置
          </button>
          <a
            className="btn btn-outline btn-secondary flex-1 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            href="https://github.com/isreturn-ture/PoeLink"
            target="_blank"
            rel="noreferrer"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 .5C5.65.5.5 5.74.5 12.26c0 5.2 3.44 9.6 8.2 11.16.6.11.82-.27.82-.6 0-.3-.01-1.08-.02-2.12-3.34.75-4.04-1.65-4.04-1.65-.54-1.42-1.33-1.8-1.33-1.8-1.08-.76.08-.74.08-.74 1.2.09 1.83 1.26 1.83 1.26 1.06 1.88 2.78 1.34 3.46 1.02.11-.8.41-1.34.75-1.64-2.66-.31-5.46-1.37-5.46-6.08 0-1.34.46-2.44 1.22-3.3-.12-.31-.53-1.57.12-3.27 0 0 1-.33 3.3 1.26a11.1 11.1 0 0 1 6 0c2.3-1.6 3.3-1.26 3.3-1.26.65 1.7.24 2.96.12 3.27.76.86 1.22 1.96 1.22 3.3 0 4.72-2.8 5.77-5.47 6.07.42.37.8 1.1.8 2.23 0 1.6-.02 2.88-.02 3.27 0 .33.22.72.82.6 4.76-1.56 8.2-5.96 8.2-11.16C23.5 5.74 18.35.5 12 .5z" />
            </svg>
            GitHub 文档
          </a>
        </div>
        <div className="divider divider-neutral my-6 w-48" />
        <p className="text-xs text-base-content/50">© 2026 PoeLink · AMR 排查助手</p>
      </div>
    </div>
  );
};

export default WelcomeView;
