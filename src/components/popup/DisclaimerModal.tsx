import React, { useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import disclaimerText from '../../../免责声明.md?raw';
import { createAppI18n } from '../../i18n';
import type { AppLocale } from '../../i18n';

interface DisclaimerModalProps {
  defaultDontShowAgain?: boolean;
  allowDontShowAgain?: boolean;
  lang?: AppLocale;
  onAgree: (opts: { dontShowAgain: boolean }) => void;
  onCancel: (opts: { dontShowAgain: boolean }) => void;
}

const DisclaimerModal = ({
  defaultDontShowAgain = false,
  allowDontShowAgain = true,
  lang = 'zh-CN',
  onAgree,
  onCancel,
}: DisclaimerModalProps) => {
  const { t } = createAppI18n(lang);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(defaultDontShowAgain);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const handleTocClick = useCallback((href?: string, event?: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href || !href.startsWith('#')) return;
    event?.preventDefault();

    const rawId = decodeURIComponent(href.slice(1));
    const container = contentRef.current;
    if (!container) return;

    // 转义成安全的 CSS 选择器
    const safeId = rawId.replace(/([ #.;?+*~'"!^$[\]()=>|/@])/g, '\\$1');
    const target = container.querySelector<HTMLElement>(`#${safeId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" aria-describedby="disclaimer-intro">
      <div className="w-full max-w-3xl max-h-[80vh] rounded-2xl bg-base-100 text-base-content shadow-2xl border border-base-300 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-base-300">
          <div className="flex flex-col gap-1">
            <h3 id="disclaimer-title" className="text-base font-semibold text-base-content">{t('disclaimerTitle')}</h3>
            <p id="disclaimer-intro" className="text-xs text-base-content/70">
              {t('disclaimerIntro')}
            </p>
          </div>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 bg-base-100">
          <div
            ref={contentRef}
            className="max-w-3xl mx-auto text-sm leading-6 text-base-content/80 space-y-4"
          >
            <div className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
              <h4 className="text-xs font-semibold tracking-wide text-base-content/70 mb-2">{t('disclaimerSummary')}</h4>
              <ul className="list-disc pl-5 space-y-1 text-xs text-base-content/70">
                <li>本扩展为个人学习研究性质的第三方浏览器扩展，与海康威视/海康机器人等权利方无官方隶属或授权关系。</li>
                <li>扩展不直接连接或操作 RCS/OPS 等业务系统前端，仅作为你与「你自行配置的后端服务」之间的桥梁（代理请求、同步 Cookie 至该后端、发送聊天内容至该后端）；不实施对任何第三方页面的 DOM 自动化，不破解、不绕过任何技术保护措施。</li>
                <li>可选配置 LLM 时，相关输入会发往你选择的第三方 API，请自行评估该服务的合规与隐私政策。</li>
                <li>你需自行评估合规性与业务风险；如不同意或无法接受声明内容，请立即卸载并停止使用本扩展。</li>
              </ul>
            </div>

            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={{
                  a: ({ href, children, ...props }) => (
                    // 自定义目录内链接的点击行为，让其滚动到弹窗内部对应位置
                    <a
                      href={href}
                      {...props}
                      onClick={(e) => {
                        if (href?.startsWith('#')) {
                          handleTocClick(href, e);
                        }
                      }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {disclaimerText}
              </ReactMarkdown>
            </div>
          </div>
        </div>
        {allowDontShowAgain && (
          <div className="px-5 pb-4">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span className="label-text">{t('disclaimerDontShow')}</span>
            </label>
          </div>
        )}
        <div className="px-5 py-4 border-t border-base-300 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
            onClick={() => onCancel({ dontShowAgain })}
            aria-label={t('cancel')}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            onClick={() => onAgree({ dontShowAgain })}
            aria-label={t('agree')}
          >
            {t('agree')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
