export default defineBackground(() => {
  console.log('TypeOver background ready', { id: browser.runtime.id });

  // Create context menu on install/update
  browser.runtime.onInstalled.addListener(() => {
    try {
      browser.contextMenus.create({
        id: 'typeover-practice-selection',
        title: 'Practice typing this text',
        contexts: ['selection'],
      });
    } catch (e) {
      console.warn('Context menu create failed (likely exists):', e);
    }
  });

  // Handle context menu click
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'typeover-practice-selection' || !tab?.id) return;
    await triggerPracticeInTab(tab.id);
  });

  // Handle keyboard shortcut command
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'typeover-practice-selection') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await triggerPracticeInTab(tab.id);
  });

  async function triggerPracticeInTab(tabId: number) {
    try {
      await browser.tabs.sendMessage(tabId, { type: 'TYPEOVER_START_PRACTICE' });
    } catch (err) {
      console.warn('Failed to send message to content script:', err);
    }
  }
});
