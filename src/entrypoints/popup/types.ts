export interface AppProps {
  onClose?: () => void;
  /** 在悬浮窗模式下由外层提供关闭按钮，不显示 Header 内关闭 */
  showCloseInHeader?: boolean;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  downloadUrl?: string;
  downloadLabel?: string;
  timeline?: TimelineItem[];
  rawThirdMsg?: unknown;
}

export interface TimelineItem {
  taskChainCode: string;
  subTaskCode: string;
  reqCode: string;
  actName: string;
  sender: string;
  receiver: string;
  amrCode: string;
  carrierCode: string;
  slotCode: string;
  cooX: string | number;
  cooY: string | number;
  createTime: string;
  startTime: string;
  updateTime: string;
  statusName: string;
}

export interface ServerConfig {
  protocol: 'HTTP' | 'HTTPS';
  host: string;
  port: string;
}

export interface DatabaseConfig {
  address: string;
  user: string;
  pass: string;
}

export interface OpsConfig {
  ip: string;
  port: string;
}

export interface LLMConfig {
  apiKey: string;
  provider: 'moonshot' | 'openai' | 'siliconflow';
  baseURL?: string;
  model?: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  streamSpeed: 'fast' | 'normal' | 'slow';
  autoSyncCookies: boolean;
}

export interface AppConfig {
  configId?: string;
  server: ServerConfig;
  database: DatabaseConfig;
  ops: OpsConfig;
  llm?: LLMConfig;
  app: AppSettings;
}

export interface ComponentVersions {
  rcs?: string;
  iwms?: string;
}

export type ConfigSection = Exclude<keyof AppConfig, 'configId' | 'llm'>;

export const defaultConfig: AppConfig = {
  server: { protocol: 'HTTP', host: '', port: '' },
  database: { address: '', user: '', pass: '' },
  ops: { ip: '', port: '' },
  llm: { apiKey: '', provider: 'siliconflow', model: '' },
  app: { theme: 'system', language: 'zh-CN', streamSpeed: 'normal', autoSyncCookies: true },
};
