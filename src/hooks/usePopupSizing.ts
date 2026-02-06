import { useEffect } from 'react';

type PopupView = 'welcome' | 'chat' | 'config';

type PopupSizingOptions = {
  view: PopupView;
};

export const usePopupSizing = ({ view }: PopupSizingOptions) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isConfigView = view === 'config';
    const width = Math.min(window.innerWidth * 0.95, isConfigView ? 920 : 720);
    const height = Math.min(window.innerHeight * 0.9, isConfigView ? 640 : 520);
    window.postMessage({ source: 'POELink', type: 'SET_UI_SIZE', width, height }, '*');
  }, [view]);
};
