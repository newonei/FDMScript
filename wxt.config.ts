import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: '飞德慕',
    description: '飞德慕浏览器自动化工具，支持远程触发电商工作流。',
    permissions: ['storage', 'alarms', 'tabs', 'scripting', 'debugger'],
    host_permissions: ['http://*/*', 'https://*/*'],
  },
});
