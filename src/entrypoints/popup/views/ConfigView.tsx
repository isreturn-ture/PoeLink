import React from 'react';

import Header from '../components/Header';

import type { AppConfig, AppSettings, LLMConfig } from '../types';

interface ConfigViewProps {
  pageTitle: string;
  pageSubtitle: string;
  onBack: () => void;
  onClose?: () => void;
  showCloseInHeader?: boolean;

  saveNotice: string;
  isConfigSaved: boolean;

  activeConfigTab: 'service' | 'llm' | 'app';
  setActiveConfigTab: React.Dispatch<React.SetStateAction<'service' | 'llm' | 'app'>>;

  steps: string[];
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;

  canProceed: boolean;
  canEnterChat: boolean;

  config: AppConfig;
  lang: AppSettings['language'];

  updateConfig: (section: any, field: any, value: any) => void;
  updateLlmConfig: (field: keyof LLMConfig, value: string) => void;

  testServer: () => void;
  testDatabase: () => void;
  testOps: () => void;

  serverTestStatus: string;
  dbTestStatus: string;
  opsTestStatus: string;

  handleSaveConfig: () => void;
  handleNextStep: () => void;
  handleSaveAndGoChat: () => void;
  handleGotoLlmTab: () => void;

  syncCookies: () => void;
  downloadLog: () => void;
  clearChatHistory: () => void;
}

const ConfigView: React.FC<ConfigViewProps> = ({
  pageTitle,
  pageSubtitle,
  onBack,
  onClose,
  showCloseInHeader,
  saveNotice,
  isConfigSaved,
  activeConfigTab,
  setActiveConfigTab,
  steps,
  currentStep,
  setCurrentStep,
  canProceed,
  canEnterChat,
  config,
  lang,
  updateConfig,
  updateLlmConfig,
  testServer,
  testDatabase,
  testOps,
  serverTestStatus,
  dbTestStatus,
  opsTestStatus,
  handleSaveConfig,
  handleNextStep,
  handleSaveAndGoChat,
  handleGotoLlmTab,
  syncCookies,
  downloadLog,
  clearChatHistory,
}) => {
  const t = (zh: string, en: string) => (lang === 'en-US' ? en : zh);

  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100">
      <Header title={pageTitle} subtitle={pageSubtitle} onBack={onBack} onClose={onClose} showClose={showCloseInHeader} />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        {saveNotice && (
          <div role="alert" className="alert alert-success mb-4 animate-slide-up">
            <span>{saveNotice}</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-60 shrink-0 sm:sticky sm:top-4 self-start">
            <div className="bg-base-100 rounded-2xl p-3 border border-base-300 shadow-sm">
              <div className="px-1 pb-2 text-xs text-base-content/70 flex items-center justify-between">
                <span>配置分组</span>
                <span className={`badge badge-xs ${isConfigSaved ? 'badge-success' : 'badge-warning'}`}>{isConfigSaved ? '已保存' : '未保存'}</span>
              </div>
              <ul className="menu menu-sm">
                <li>
                  <button
                    type="button"
                    className={activeConfigTab === 'service' ? 'active' : ''}
                    onClick={() => {
                      setActiveConfigTab('service');
                      setCurrentStep((p) => (p >= 1 && p <= 3 ? p : 1));
                    }}
                  >
                    {t('服务配置', 'Service')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={activeConfigTab === 'llm' ? 'active' : ''}
                    onClick={() => setActiveConfigTab('llm')}
                  >
                    {t('LLM 配置', 'LLM')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={activeConfigTab === 'app' ? 'active' : ''}
                    onClick={() => setActiveConfigTab('app')}
                  >
                    {t('应用配置', 'App')}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {activeConfigTab === 'service' && (
              <>
                {/* 步骤指示器 - daisyUI steps */}
                <ul className="steps steps-horizontal w-full mb-6 text-xs">
                  {steps.map((stepName, index) => {
                    const stepNum = index + 1;
                    const isActive = currentStep >= stepNum;
                    return (
                      <li key={stepNum} className={`step transition-all duration-300 ${isActive ? 'step-primary' : ''}`}>
                        {stepName}
                      </li>
                    );
                  })}
                </ul>

                {/* Step 1: 服务器配置 */}
                {currentStep === 1 && (
                  <div className="animate-fade-in-up">
                    <div className="card bg-base-200 shadow-sm card-border">
                      <div className="card-body">
                        <h4 className="card-title">服务器配置</h4>
                        <div className="space-y-4">
                          <label className="label">
                            <span className="label-text">协议</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.server.protocol}
                            onChange={(e) => updateConfig('server', 'protocol', e.target.value as 'HTTP' | 'HTTPS')}
                          >
                            <option value="HTTP">HTTP</option>
                            <option value="HTTPS">HTTPS</option>
                          </select>
                          <label className="label">
                            <span className="label-text">主机/地址</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="例如 localhost 或 192.168.1.100"
                            value={config.server.host}
                            onChange={(e) => updateConfig('server', 'host', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">端口</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="例如 8080"
                            value={config.server.port}
                            onChange={(e) => updateConfig('server', 'port', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                              onClick={testServer}
                            >
                              测试服务器连接
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                              onClick={handleSaveConfig}
                            >
                              保存配置
                            </button>
                          </div>
                          {serverTestStatus && (
                            <div
                              role="alert"
                              className={`alert ${serverTestStatus.includes('成功') ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}
                            >
                              <span>{serverTestStatus}</span>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-base-300">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                              >
                                上一步
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={handleNextStep}
                                disabled={!canProceed}
                              >
                                下一步
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={handleSaveAndGoChat}
                                disabled={!canEnterChat}
                              >
                                保存并进入
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: 数据库配置 */}
                {currentStep === 2 && (
                  <div className="animate-fade-in-up">
                    <div className="card bg-base-200 shadow-sm card-border">
                      <div className="card-body">
                        <h4 className="card-title">数据库配置</h4>
                        <div className="space-y-4">
                          <label className="label">
                            <span className="label-text">地址</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="数据库地址"
                            value={config.database.address}
                            onChange={(e) => updateConfig('database', 'address', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">用户名</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="数据库用户名"
                            value={config.database.user}
                            onChange={(e) => updateConfig('database', 'user', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">密码</span>
                          </label>
                          <input
                            type="password"
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="数据库密码"
                            value={config.database.pass}
                            onChange={(e) => updateConfig('database', 'pass', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                              onClick={testDatabase}
                            >
                              测试数据库连接
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                              onClick={handleSaveConfig}
                            >
                              保存配置
                            </button>
                          </div>
                          {dbTestStatus && (
                            <div
                              role="alert"
                              className={`alert ${dbTestStatus.includes('成功') ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}
                            >
                              <span>{dbTestStatus}</span>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-base-300">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                                disabled
                              >
                                上一步
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={handleNextStep}
                                disabled={!canProceed}
                              >
                                下一步
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={handleSaveAndGoChat}
                                disabled={!canEnterChat}
                              >
                                保存并进入
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: 运管系统配置 */}
                {currentStep === 3 && (
                  <div className="animate-fade-in-up">
                    <div className="card bg-base-200 shadow-sm card-border">
                      <div className="card-body">
                        <h4 className="card-title">运管系统配置</h4>
                        <div className="space-y-4">
                          <label className="label">
                            <span className="label-text">IP地址</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="运管系统IP"
                            value={config.ops.ip}
                            onChange={(e) => updateConfig('ops', 'ip', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">端口</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder="运管系统端口"
                            value={config.ops.port}
                            onChange={(e) => updateConfig('ops', 'port', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                              onClick={testOps}
                            >
                              测试运管系统连接
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                              onClick={handleSaveConfig}
                            >
                              保存配置
                            </button>
                          </div>
                          {opsTestStatus && (
                            <div
                              role="alert"
                              className={`alert ${opsTestStatus.includes('成功') ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}
                            >
                              <span>{opsTestStatus}</span>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-base-300">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                              >
                                上一步
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={handleGotoLlmTab}
                                disabled={!canProceed}
                              >
                                LLM 配置
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline flex-1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                onClick={handleSaveAndGoChat}
                                disabled={!canEnterChat}
                              >
                                保存并进入
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeConfigTab === 'llm' && (
              <>
                {/* Step 4: LLM 配置 */}
                <div className="animate-fade-in-up">
                  <div className="card bg-base-200 shadow-sm card-border">
                    <div className="card-body">
                      <h4 className="card-title">LLM 配置（API Key）</h4>
                      <div className="text-sm text-base-content/70 mb-4 space-y-1">
                        <div>本功能支持两种运行模式</div>
                        <div>智能模式：输入 API Key 后，调用云端 AI 进行意图识别（推荐）</div>
                        <div>本地模式：不配置 Key 时，使用设备本地规则处理</div>
                      </div>
                      <div className="space-y-4">
                        <label className="label">
                          <span className="label-text">API Key</span>
                        </label>
                        <input
                          type="password"
                          className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                          placeholder="SiliconFlow / Moonshot / OpenAI API Key（可选）"
                          value={config.llm?.apiKey ?? ''}
                          onChange={(e) => updateLlmConfig('apiKey', e.target.value)}
                        />
                        <label className="label">
                          <span className="label-text">提供商</span>
                        </label>
                        <select
                          className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                          value={config.llm?.provider ?? 'siliconflow'}
                          onChange={(e) => updateLlmConfig('provider', e.target.value as LLMConfig['provider'])}
                        >
                          <option value="siliconflow">SiliconFlow (GLM)</option>
                          <option value="moonshot">Moonshot (月之暗面 / Kimi)</option>
                          <option value="openai">OpenAI</option>
                        </select>
                        <label className="label">
                          <span className="label-text">默认模型</span>
                        </label>
                        <input
                          className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                          placeholder="例如 THUDM/GLM-Z1-9B-0414 / moonshot-v1-8k / gpt-3.5-turbo（可选）"
                          value={config.llm?.model ?? ''}
                          onChange={(e) => updateLlmConfig('model', e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          onClick={handleSaveConfig}
                        >
                          保存配置
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeConfigTab === 'app' && (
              <div className="animate-fade-in-up">
                <div className="card bg-base-200 shadow-sm card-border">
                  <div className="card-body">
                    <h4 className="card-title">应用配置</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="label">
                            <span className="label-text">{t('主题', 'Theme')}</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.app?.theme ?? 'system'}
                            onChange={(e) => updateConfig('app', 'theme', e.target.value as AppSettings['theme'])}
                          >
                            <option value="system">{t('跟随系统', 'System')}</option>
                            <option value="light">{t('浅色', 'Light')}</option>
                            <option value="dark">{t('深色', 'Dark')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text">{t('语言', 'Language')}</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.app?.language ?? 'zh-CN'}
                            onChange={(e) => updateConfig('app', 'language', e.target.value as AppSettings['language'])}
                          >
                            <option value="zh-CN">中文</option>
                            <option value="en-US">English</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text">{t('流式输出速度', 'Streaming speed')}</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.app?.streamSpeed ?? 'normal'}
                            onChange={(e) => updateConfig('app', 'streamSpeed', e.target.value as AppSettings['streamSpeed'])}
                          >
                            <option value="fast">{t('快', 'Fast')}</option>
                            <option value="normal">{t('正常', 'Normal')}</option>
                            <option value="slow">{t('慢', 'Slow')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text">{t('自动同步 Cookie', 'Auto sync cookies')}</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="toggle toggle-primary"
                              checked={!!config.app?.autoSyncCookies}
                              onChange={(e) => updateConfig('app', 'autoSyncCookies', e.target.checked)}
                            />
                            <span className="text-sm text-base-content/70">
                              {config.app?.autoSyncCookies ? t('已开启', 'On') : t('已关闭', 'Off')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          onClick={syncCookies}
                        >
                          同步 Cookie
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          onClick={downloadLog}
                        >
                          下载运行日志
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          onClick={clearChatHistory}
                        >
                          清除排查记录
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                        onClick={handleSaveConfig}
                      >
                        {t('保存配置', 'Save')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigView;
