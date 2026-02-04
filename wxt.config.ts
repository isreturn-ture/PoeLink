import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    server: {
      port: 3999
    }
  }),
  manifest: {
    permissions: ['storage', 'cookies', 'tabs', 'notifications'],
    host_permissions: [
      '*://*/*',
      'https://api.moonshot.cn/*',
      'https://api.openai.com/*',
      'https://api.siliconflow.cn/*'
    ],
    web_accessible_resources: [
      {
        resources: ['popup.html', 'content-scripts/content.css'],
        use_dynamic_url: true,
        matches: ['*://*/*']
      }
    ]
  }
});
