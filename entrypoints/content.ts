import { countWords, isEditable } from "./content/utils";
import { showToast } from "./content/ui";
import { TypeOverSession } from "./content/session";
import { getPrefs } from "./shared/prefs";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("TypeOver content ready.");

    let session: TypeOverSession | null = null;

    browser.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "TYPEOVER_START_PRACTICE") void startPracticeFromSelection();
    });

    async function startPracticeFromSelection() {
      if (session) { session.dispose(); session = null; }
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString() ?? "";
      if (countWords(text) < 20) { showToast("Select at least 20 words to practice."); return; }
      const range = sel.getRangeAt(0);
      if (isEditable(sel.anchorNode)) { showToast("Selection inside an input is not supported. Select page text."); return; }
      try { sel.removeAllRanges(); } catch {}
      const prefs = await getPrefs();
      const s = new TypeOverSession(range, prefs);
      const ok = s.init();
      if (!ok) return;
      session = s;
    }
  },
});
