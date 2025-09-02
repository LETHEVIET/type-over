import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['activeTab', 'contextMenus', 'storage'],
    host_permissions: ['<all_urls>'],
    commands: {
      'typeover-practice-selection': {
        suggested_key: {
          default: 'Alt+Shift+T',
          mac: 'Alt+Shift+T',
        },
        description: 'Practice typing the current selection',
      },
    },
  },
});
