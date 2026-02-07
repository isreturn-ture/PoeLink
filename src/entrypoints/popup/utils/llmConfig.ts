/**
 * 共享 LLM 配置工具（API 地址、默认模型等）
 * 供 EntityService、IntentService 等使用
 */
import type { LLMConfig } from '../types';

const PROVIDER_BASE_URLS: Record<LLMConfig['provider'], string> = {
  moonshot: 'https://api.moonshot.cn/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  openai: 'https://api.openai.com/v1',
};

const PROVIDER_DEFAULT_MODELS: Record<LLMConfig['provider'], string> = {
  moonshot: 'moonshot-v1-8k',
  siliconflow: 'THUDM/GLM-Z1-9B-0414',
  openai: 'gpt-3.5-turbo',
};

export function getApiBaseUrl(config: LLMConfig): string {
  if (config.baseURL) return config.baseURL;
  return PROVIDER_BASE_URLS[config.provider];
}

export function getDefaultModel(config: LLMConfig): string {
  return PROVIDER_DEFAULT_MODELS[config.provider];
}

export function resolveModel(config: LLMConfig): string {
  const m = typeof config.model === 'string' ? config.model.trim() : '';
  return m || getDefaultModel(config);
}
