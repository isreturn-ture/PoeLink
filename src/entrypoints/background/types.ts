export interface Message {
  type: string;
  [key: string]: any;
}

export interface ServerConfig {
  host: string;
  port: number | string;
  protocol: string;
  ip?: string;
}

export interface PoeLinkConfig {
  server: ServerConfig;
  database?: any;
  ops?: any;
  app?: {
    autoSyncCookies?: boolean;
  };
}
