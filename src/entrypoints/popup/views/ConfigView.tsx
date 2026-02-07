import React from 'react';

import Header from '../../../components/popup/Header';
import { createConfigI18n } from '../../../i18n';

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
  const { t } = createConfigI18n(lang);

  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100">
      <Header title={pageTitle} subtitle={pageSubtitle} onBack={onBack} onClose={onClose} showClose={showCloseInHeader} backAriaLabel={t('back')} closeAriaLabel={t('close')} />

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
                <span>{t('configGroup')}</span>
                <span className={`badge badge-xs ${isConfigSaved ? 'badge-success' : 'badge-warning'}`}>{isConfigSaved ? t('saved') : t('unsaved')}</span>
              </div>
              <ul className="menu menu-sm gap-0.5">
                <li>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer hover:bg-base-200 ${activeConfigTab === 'service' ? 'bg-primary/10 text-primary' : 'text-base-content'} focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2`}
                    onClick={() => {
                      setActiveConfigTab('service');
                      setCurrentStep((p) => (p >= 1 && p <= 3 ? p : 1));
                    }}
                  >
                    {t('serviceConfig')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer hover:bg-base-200 ${activeConfigTab === 'llm' ? 'bg-primary/10 text-primary' : 'text-base-content'} focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2`}
                    onClick={() => setActiveConfigTab('llm')}
                  >
                    {t('llmConfig')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer hover:bg-base-200 ${activeConfigTab === 'app' ? 'bg-primary/10 text-primary' : 'text-base-content'} focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2`}
                    onClick={() => setActiveConfigTab('app')}
                  >
                    {t('appConfig')}
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
                        <h4 className="card-title">{t('serverConfig')}</h4>
                        <div className="space-y-4">
                          <label className="label">
                            <span className="label-text">{t('protocol')}</span>
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
                            <span className="label-text">{t('host')}</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('hostPlaceholder')}
                            value={config.server.host}
                            onChange={(e) => updateConfig('server', 'host', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">{t('port')}</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('portPlaceholder')}
                            value={config.server.port}
                            onChange={(e) => updateConfig('server', 'port', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary transition-colors duration-200 hover:opacity-90 cursor-pointer"
                              onClick={testServer}
                            >
                              {t('testServer')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                              onClick={handleSaveConfig}
                            >
                              {t('saveConfig')}
                            </button>
                          </div>
                          {serverTestStatus && (
                            <div
                              role="alert"
                              className={`alert ${serverTestStatus.includes(t('connectSuccess')) ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}
                            >
                              <span>{serverTestStatus}</span>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-base-300">
                            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                              >
                                {t('prevStep')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={handleNextStep}
                                disabled={!canProceed}
                              >
                                {t('nextStep')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={handleSaveAndGoChat}
                                disabled={!canEnterChat}
                              >
                                {t('saveAndEnter')}
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
                        <h4 className="card-title">{t('databaseConfig')}</h4>
                        <div className="space-y-4">
                          <label className="label">
                            <span className="label-text">{t('address')}</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('dbAddressPlaceholder')}
                            value={config.database.address}
                            onChange={(e) => updateConfig('database', 'address', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">{t('username')}</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('dbUserPlaceholder')}
                            value={config.database.user}
                            onChange={(e) => updateConfig('database', 'user', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">{t('password')}</span>
                          </label>
                          <input
                            type="password"
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('dbPassPlaceholder')}
                            value={config.database.pass}
                            onChange={(e) => updateConfig('database', 'pass', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary transition-colors duration-200 hover:opacity-90 cursor-pointer"
                              onClick={testDatabase}
                            >
                              {t('testDatabase')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                              onClick={handleSaveConfig}
                            >
                              {t('saveConfig')}
                            </button>
                          </div>
                          {dbTestStatus && (
                            <div
                              role="alert"
                              className={`alert ${dbTestStatus.includes(t('connectSuccess')) ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}
                            >
                              <span>{dbTestStatus}</span>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-base-300">
                            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                              >
                                {t('prevStep')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={handleNextStep}
                                disabled={!canProceed}
                              >
                                {t('nextStep')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={handleSaveAndGoChat}
                                disabled={!canEnterChat}
                              >
                                {t('saveAndEnter')}
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
                        <h4 className="card-title">{t('opsConfig')}</h4>
                        <div className="space-y-4">
                          <label className="label">
                            <span className="label-text">{t('ipAddress')}</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('opsIpPlaceholder')}
                            value={config.ops.ip}
                            onChange={(e) => updateConfig('ops', 'ip', e.target.value)}
                          />
                          <label className="label">
                            <span className="label-text">{t('port')}</span>
                          </label>
                          <input
                            className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            placeholder={t('opsPortPlaceholder')}
                            value={config.ops.port}
                            onChange={(e) => updateConfig('ops', 'port', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary transition-colors duration-200 hover:opacity-90 cursor-pointer"
                              onClick={testOps}
                            >
                              {t('testOps')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                              onClick={handleSaveConfig}
                            >
                              {t('saveConfig')}
                            </button>
                          </div>
                          {opsTestStatus && (
                            <div
                              role="alert"
                              className={`alert ${opsTestStatus.includes(t('connectSuccess')) ? 'alert-success' : 'alert-error'} mt-2 animate-slide-up`}
                            >
                              <span>{opsTestStatus}</span>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-base-300">
                            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                              >
                                {t('prevStep')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={handleGotoLlmTab}
                                disabled={!canProceed}
                              >
                                {t('goToLlm')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline flex-1 min-w-0 cursor-pointer transition-colors duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:opacity-50"
                                onClick={handleSaveAndGoChat}
                                disabled={!canEnterChat}
                              >
                                {t('saveAndEnter')}
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
                      <h4 className="card-title">{t('llmConfigTitle')}</h4>
                      <div className="text-sm text-base-content/70 mb-4 space-y-1">
                        <div>{t('llmModeIntro1')}</div>
                        <div>{t('llmModeIntro2')}</div>
                        <div>{t('llmModeIntro3')}</div>
                      </div>
                      <div className="space-y-4">
                        <label className="label">
                          <span className="label-text">{t('apiKey')}</span>
                        </label>
                        <input
                          type="password"
                          className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                          placeholder={t('apiKeyPlaceholder')}
                          value={config.llm?.apiKey ?? ''}
                          onChange={(e) => updateLlmConfig('apiKey', e.target.value)}
                        />
                        <label className="label">
                          <span className="label-text">{t('provider')}</span>
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
                          <span className="label-text">{t('model')}</span>
                        </label>
                        <input
                          className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                          placeholder={t('modelPlaceholder')}
                          value={config.llm?.model ?? ''}
                          onChange={(e) => updateLlmConfig('model', e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                          onClick={handleSaveConfig}
                        >
                          {t('saveConfig')}
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
                    <h4 className="card-title">{t('appConfig')}</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="label">
                            <span className="label-text">{t('theme')}</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.app?.theme ?? 'system'}
                            onChange={(e) => updateConfig('app', 'theme', e.target.value as AppSettings['theme'])}
                          >
                            <option value="system">{t('themeSystem')}</option>
                            <option value="light">{t('themeLight')}</option>
                            <option value="dark">{t('themeDark')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text">{t('language')}</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.app?.language ?? 'zh-CN'}
                            onChange={(e) => updateConfig('app', 'language', e.target.value as AppSettings['language'])}
                          >
                            <option value="zh-CN">{t('langZh')}</option>
                            <option value="en-US">{t('langEn')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text">{t('streamingSpeed')}</span>
                          </label>
                          <select
                            className="select select-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            value={config.app?.streamSpeed ?? 'normal'}
                            onChange={(e) => updateConfig('app', 'streamSpeed', e.target.value as AppSettings['streamSpeed'])}
                          >
                            <option value="fast">{t('speedFast')}</option>
                            <option value="normal">{t('speedNormal')}</option>
                            <option value="slow">{t('speedSlow')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text">{t('autoSyncCookies')}</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="toggle toggle-primary"
                              checked={!!config.app?.autoSyncCookies}
                              onChange={(e) => updateConfig('app', 'autoSyncCookies', e.target.checked)}
                            />
                            <span className="text-sm text-base-content/70">
                              {config.app?.autoSyncCookies ? t('on') : t('off')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                          onClick={syncCookies}
                        >
                          {t('syncCookies')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                          onClick={downloadLog}
                        >
                          {t('downloadLog')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                          onClick={clearChatHistory}
                        >
                          {t('clearHistory')}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline transition-colors duration-200 hover:opacity-90 cursor-pointer"
                        onClick={handleSaveConfig}
                      >
                        {t('saveConfig')}
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
