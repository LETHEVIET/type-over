import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  manifest: {
    permissions: ['activeTab', 'contextMenus', 'storage'],
    host_permissions: ['<all_urls>'],
    commands: {
      'typeover-practice-selection': {
        suggested_key: {
          default: 'Alt+T',
          mac: 'Alt+T',
        },
        description: 'Practice typing the current selection',
      },
    },
  },
});
