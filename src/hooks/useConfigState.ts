import { useCallback, useEffect, useState } from 'react';

import communicationService from '../entrypoints/popup/services/CommunicationService';
import storageService from '../entrypoints/popup/services/StorageService';
import { defaultConfig, type AppConfig, type ConfigSection, type LLMConfig } from '../entrypoints/popup/types';
import { applyThemeToDocument } from './useThemeSetting';

type ConfigStateOptions = {
  onConfigured?: () => void;
};

export const useConfigState = ({ onConfigured }: ConfigStateOptions = {}) => {
  const [config, setConfig] = useState<AppConfig>(() => defaultConfig);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isConfigSaved, setIsConfigSaved] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const savedConfig = await storageService.getConfig();
      if (savedConfig && mounted) {
        const merged: AppConfig = {
          ...defaultConfig,
          ...savedConfig,
          llm: {
            ...(defaultConfig.llm ?? { apiKey: '', provider: 'siliconflow', model: '' }),
            ...(savedConfig.llm ?? {}),
          },
          app: {
            ...defaultConfig.app,
            ...((savedConfig as any).app ?? {}),
          },
        };
        setConfig(merged);
        const hasServer = !!(merged.server?.host?.trim() && merged.server?.port?.trim());
        setIsConfigured(hasServer);
        setIsConfigSaved(true);
        if (hasServer) {
          onConfigured?.();
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [onConfigured]);

  // 配置现存 SQLite，不再监听 browser.storage.onChanged

  const hasServerConfig = useCallback(() => {
    return !!(config.server?.host?.trim() && config.server?.port?.trim());
  }, [config.server]);

  const isStepComplete = useCallback(
    (step: number) => {
      switch (step) {
        case 1:
          return !!(config.server?.host?.trim() && config.server?.port?.trim());
        case 2:
          return !!(config.database?.address?.trim() && config.database?.user?.trim() && config.database?.pass?.trim());
        case 3:
          return !!(config.ops?.ip?.trim() && String(config.ops?.port ?? '').trim());
        case 4:
          return true;
        default:
          return false;
      }
    },
    [config.server, config.database, config.ops]
  );

  const updateConfig = useCallback(<K extends ConfigSection, F extends keyof AppConfig[K]>(
    section: K,
    field: F,
    value: AppConfig[K][F]
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    setIsConfigSaved(false);
  }, []);

  const updateLlmConfig = useCallback((field: keyof LLMConfig, value: string) => {
    setConfig((prev) => ({
      ...prev,
      llm: {
        ...(prev.llm || { apiKey: '', provider: 'siliconflow', model: '' }),
        [field]: value,
      },
    }));
    setIsConfigSaved(false);
  }, []);

  const saveConfig = useCallback(async () => {
    let configId: string | undefined;
    try {
      const validateResp = await communicationService.validateConfig(config);
      configId = validateResp?.data?.data?.config_id;
    } catch {
      configId = undefined;
    }
    const nextConfig: AppConfig = {
      ...config,
      configId,
      llm: config.llm ?? { apiKey: '', provider: 'siliconflow', model: '' },
      app: config.app ?? defaultConfig.app,
    };
    await storageService.setConfig(nextConfig);
    setConfig(nextConfig);
    setIsConfigured(!!(nextConfig.server?.host?.trim() && nextConfig.server?.port?.trim()));
    setIsConfigSaved(true);
    applyThemeToDocument(nextConfig.app?.theme);
  }, [config]);

  return {
    config,
    setConfig,
    isConfigured,
    isConfigSaved,
    setIsConfigSaved,
    hasServerConfig,
    isStepComplete,
    updateConfig,
    updateLlmConfig,
    saveConfig,
  };
};
