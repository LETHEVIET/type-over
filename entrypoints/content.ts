import { countWords, isEditable } from './content/utils';
import { showToast } from './content/ui';
import { TypeOverSession } from './content/session';
import { getPrefs } from './shared/prefs';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('TypeOver content ready.');

    let session: TypeOverSession | null = null;

    browser.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'TYPEOVER_START_PRACTICE') void startPracticeFromSelection();
    });

    async function startPracticeFromSelection() {
      if (session) {
        session.dispose();
        session = null;
      }
      const sel = window.getSelection?.();
      // No selection -> prompt user to select enough words
      if (!sel || sel.rangeCount === 0) {
        showToast('Select at least 20 words to practice.');
        return;
      }
      // Disallow selections inside editable controls first for clearer messaging
      if (isEditable(sel.anchorNode)) {
        showToast('Selection inside an input is not supported. Select page text.');
        return;
      }
      const text = sel.toString() ?? '';
      const prefs = await getPrefs();
      const min = Math.max(1, Math.floor(prefs.minWords || 20));
      if (countWords(text) < min) {
        showToast(`Select at least ${min} words to practice.`);
        return;
      }
      const range = sel.getRangeAt(0);
      try {
        sel.removeAllRanges();
      } catch {}
      const s = new TypeOverSession(range, prefs);
      const ok = s.init();
      if (!ok) return;
      session = s;
    }
  },
});
