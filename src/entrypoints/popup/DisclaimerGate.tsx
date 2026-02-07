import React, { useEffect, useState } from 'react';

import DisclaimerModal from '../../components/popup/DisclaimerModal';
import { createAppI18n } from '../../i18n';
import type { AppProps } from './types';
import type { AppLocale } from '../../i18n';
import storageService from './services/StorageService';
import MainApp from './MainApp';

const DisclaimerGate: React.FC<AppProps> = ({ onClose, showCloseInHeader = true }) => {
  const [agreed, setAgreed] = useState<boolean | null>(null);
  const [dontShowAgainDefault, setDontShowAgainDefault] = useState(false);
  const [lang, setLang] = useState<AppLocale>('zh-CN');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [state, config] = await Promise.all([
        storageService.getDisclaimerState(),
        storageService.getConfig(),
      ]);
      if (!mounted) return;
      const ok = state?.agreed === true;
      setAgreed(ok);
      setDontShowAgainDefault(Boolean(state?.dontShowAgain));
      if (config?.app?.language) setLang(config.app.language as AppLocale);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (agreed !== true) {
    if (agreed === null) {
      const { t } = createAppI18n(lang);
      return (
        <div className="flex flex-col h-full min-h-0 items-center justify-center bg-base-200" role="status" aria-label={t('loading')}>
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-3 text-sm text-base-content/70">{t('loading')}</p>
        </div>
      );
    }
    return (
      <DisclaimerModal
        lang={lang}
        allowDontShowAgain={false}
        defaultDontShowAgain={dontShowAgainDefault}
        onAgree={async ({ dontShowAgain }) => {
          await storageService.setDisclaimerState({ agreed: true, dontShowAgain });
          setAgreed(true);
        }}
        onCancel={async () => {
          await storageService.setDisclaimerState({ agreed: false, dontShowAgain: false });
          if (typeof onClose === 'function') {
            onClose();
            return;
          }
          try {
            window.close();
          } catch {
            // ignore
          }
          setDontShowAgainDefault(false);
          setAgreed(false);
        }}
      />
    );
  }

  return <MainApp onClose={onClose} showCloseInHeader={showCloseInHeader} />;
};

export default DisclaimerGate;
