export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("TypeOver content ready.");

    // Session state
    let activeSession: null | {
      chars: Array<{ el: HTMLSpanElement; ch: string; text: Text | null; status: 0 | 1 | -1 }>;
      fragments: HTMLSpanElement[];
      index: number;
      keydown: (e: KeyboardEvent) => void;
      beforeInput: (e: InputEvent) => void;
      onSelectionChange: () => void;
      placeCaret: (i: number) => void;
      // metrics
      startTime: number;
      typedCount: number;
      correctCount: number;
      badgeEl: HTMLDivElement;
      badgeTimer: number | null;
      updateBadge: () => void;
      updateBadgePosition: () => void;
      onScroll: () => void;
      onResize: () => void;
    } = null;

    // Listen for background trigger
    browser.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "TYPEOVER_START_PRACTICE") {
        startPracticeFromSelection();
      }
    });

    function startPracticeFromSelection() {
      if (activeSession) endSession();
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString() ?? "";
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < 20) {
        simpleToast("Select at least 20 words to practice.");
        return;
      }
  const range = sel.getRangeAt(0);
      // If selection is inside an editable field, bail
      const anchorEditable = isEditable(sel.anchorNode);
      if (anchorEditable) {
        simpleToast(
          "Selection inside an input is not supported. Select page text."
        );
        return;
      }
      // Remove selection highlight to avoid blue overlay during practice
      try {
        sel.removeAllRanges();
      } catch {}
  activeSession = createInlinePractice(range);
  if (!activeSession) return;
  // Ensure caret and focus are set after clearing selection
  try { activeSession.placeCaret(0); } catch {}
  document.addEventListener("keydown", activeSession.keydown, true);
  document.addEventListener("beforeinput", activeSession.beforeInput as any, true);
  document.addEventListener("selectionchange", activeSession.onSelectionChange, true);
    }

    function createInlinePractice(range: Range) {
  const affectedFragments: HTMLSpanElement[] = [];
  const charList: Array<{ el: HTMLSpanElement; ch: string; text: Text | null; status: 0 | 1 | -1 }> = [];

      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.textContent) return NodeFilter.FILTER_REJECT;
            // Only include nodes intersecting the range
            const nodeRange = document.createRange();
            nodeRange.selectNodeContents(node);
            const intersects =
              range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
              range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
            nodeRange.detach?.();
            return intersects
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          },
        }
      );

      const segments: Array<{ node: Text; start: number; end: number }> = [];
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const len = node.data.length;
        let start = 0;
        let end = len;

        if (node === range.startContainer) start = range.startOffset;
        if (node === range.endContainer) end = range.endOffset;
        // Skip empty segments
        if (start >= end) continue;
        segments.push({ node, start, end });
      }

      if (segments.length === 0) return null;

      // Mutate DOM: wrap selected segments and create per-char spans
      for (const { node, start, end } of segments) {
        let target = node;
        // Split start
        if (start > 0) {
          target = target.splitText(start);
        }
        // Split end relative to current target
        const spanLen = end - start;
        if (spanLen < target.data.length) {
          target.splitText(spanLen);
        }

        const fragment = document.createElement("span");
  fragment.className = "typeover-fragment";
  fragment.style.whiteSpace = "pre-wrap";
  fragment.contentEditable = "true";
  (fragment as any).spellcheck = false;
  fragment.style.outline = "none";
        target.parentNode?.replaceChild(fragment, target);

        const textContent = target.data;
        for (let i = 0; i < textContent.length; i++) {
          const ch = textContent[i];
          const charEl = document.createElement("span");
          charEl.className = "typeover-char";
          charEl.textContent = ch;
          // Start gray; we'll remove color on correct
          charEl.style.color = "#9ca3af";
          fragment.appendChild(charEl);
          charList.push({ el: charEl, ch, text: charEl.firstChild as Text, status: 0 });
        }
        affectedFragments.push(fragment);
      }
      // Metrics HUD (overlay badge)
      const badgeEl = document.createElement('div');
      badgeEl.id = 'typeover-hud';
      Object.assign(badgeEl.style, {
        position: 'fixed',
        zIndex: '2147483647',
        background: 'rgba(17, 24, 39, 0.9)',
        color: '#e5e7eb',
        border: '1px solid #374151',
        borderRadius: '10px',
        padding: '8px 10px',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '1.2',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      } as CSSStyleDeclaration);
      document.body.appendChild(badgeEl);

      const startTime = Date.now();
      let typedCount = 0;
      let correctCount = 0;

      const updateBadge = () => {
        const elapsedMs = Math.max(1, Date.now() - startTime);
        const minutes = elapsedMs / 60000;
        const wpm = minutes > 0 ? Math.round((correctCount / 5) / minutes) : 0;
        const acc = typedCount > 0 ? Math.round((correctCount / typedCount) * 100) : 100;
        badgeEl.textContent = `WPM ${wpm} · Acc ${acc}% · Enter to finish`;
      };
      updateBadge();
      const badgeTimer = window.setInterval(updateBadge, 1000);

      const updateBadgePosition = () => {
        if (affectedFragments.length === 0) return;
        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        for (const frag of affectedFragments) {
          const r = frag.getBoundingClientRect();
          left = Math.min(left, r.left);
          top = Math.min(top, r.top);
          right = Math.max(right, r.right);
          bottom = Math.max(bottom, r.bottom);
        }
        const pad = 8;
        badgeEl.style.left = `${Math.max(0, left)}px`;
        badgeEl.style.top = `${Math.max(0, bottom + pad)}px`;
      };
      updateBadgePosition();

  const placeCaret = (i: number) => {
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        const range = document.createRange();
        if (charList.length === 0) return;
        if (i <= 0) {
          const first = charList[0];
          const tn = first.text;
          if (tn) {
            range.setStart(tn, 0);
          } else {
            range.setStartBefore(first.el);
          }
        } else if (i >= charList.length) {
          const last = charList[charList.length - 1];
          const tn = last.text;
          if (tn) {
            range.setStart(tn, tn.length);
          } else {
            range.setStartAfter(last.el);
          }
        } else {
          const prev = charList[i - 1];
          const tn = prev.text;
          if (tn) {
            range.setStart(tn, tn.length);
          } else {
            range.setStartAfter(prev.el);
          }
        }
  range.collapse(true);
        sel.addRange(range);
        // Focus the fragment containing the caret
  const currentEl = (i <= 0 ? charList[0].el : charList[Math.min(i, charList.length - 1)].el);
  const host = currentEl.closest('.typeover-fragment') as HTMLSpanElement | null;
  try { host?.focus({ preventScroll: true }); } catch { host?.focus(); }
  // Keep caret visible without jumping the page too much
  try { currentEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {}
  // Keep badge positioned under the selection
  try { updateBadgePosition(); } catch {}
      };

      const keydown = (e: KeyboardEvent) => {
        // Handle controls
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          endSession();
          return;
        }
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          finishSession();
          return;
        }
      };

      const beforeInput = (e: InputEvent) => {
        if (!activeSession) return;
        const type = e.inputType;
        // Only allow navigation via our logic; prevent actual DOM edits
        if (type === 'insertText') {
          const data = e.data ?? '';
          if (data.length !== 1) { e.preventDefault(); return; }
          e.preventDefault();
          const i = activeSession.index;
          if (i >= activeSession.chars.length) { finishSession(); return; }
          const item = activeSession.chars[i];
          const { el, ch } = item;
          const expected = normalizeChar(ch);
          const got = normalizeChar(data);
          if (got === expected) {
            el.style.removeProperty('color');
            item.status = 1;
            correctCount++;
          } else {
            el.style.color = '#ef4444';
            item.status = -1;
          }
          typedCount++;
          activeSession.index++;
          if (activeSession.index >= activeSession.chars.length) { finishSession(); return; }
          activeSession.placeCaret(activeSession.index);
          activeSession.updateBadge();
          return;
        }
        if (type === 'deleteContentBackward') {
          e.preventDefault();
          if (activeSession.index > 0) {
            activeSession.index--;
            const item = activeSession.chars[activeSession.index];
            const { el } = item;
            el.style.color = '#9ca3af';
            if (item.status !== 0) {
              typedCount = Math.max(0, typedCount - 1);
              if (item.status === 1) correctCount = Math.max(0, correctCount - 1);
              item.status = 0;
            }
            activeSession.placeCaret(activeSession.index);
            activeSession.updateBadge();
          }
          return;
        }
        if (type === 'insertLineBreak') {
          e.preventDefault();
          finishSession();
          return;
        }
        // Block other edits to keep DOM stable
        e.preventDefault();
      };

      const onSelectionChange = () => {
        if (!activeSession) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        // Only react if caret is inside one of our fragments
        const anchor = sel.anchorNode;
        if (!anchor) return;
        const frag = (anchor instanceof Element ? anchor : anchor.parentElement)?.closest('.typeover-fragment');
        if (!frag) return;
        // Map caret to global index
        const container = sel.anchorNode as Node;
        let el: HTMLElement | null = container instanceof Element ? container as HTMLElement : container.parentElement;
        if (!el) return;
        const charEl = el.closest('.typeover-char') as HTMLSpanElement | null;
        if (!charEl) return;
        const idx = activeSession.chars.findIndex((c) => c.el === charEl);
        if (idx === -1) return;
        const offset = sel.anchorOffset; // 0 = before, >=1 = after (for 1-char text nodes)
        const newIndex = Math.min(activeSession.chars.length, idx + (offset > 0 ? 1 : 0));
        activeSession.index = newIndex;
      };

      function finishSession() {
        endSession();
      }

      function normalizeChar(c: string) {
        // Treat all whitespace as a single space
        return /\s/.test(c) ? " " : c;
      }

      const onScroll = () => updateBadgePosition();
      const onResize = () => updateBadgePosition();

      activeSession = {
        chars: charList,
        fragments: affectedFragments,
        index: 0,
        keydown,
        beforeInput,
        onSelectionChange,
        placeCaret,
        startTime,
        typedCount,
        correctCount,
        badgeEl,
        badgeTimer,
        updateBadge,
        updateBadgePosition,
        onScroll,
        onResize,
      };
  // Initial caret placement
  activeSession.placeCaret(0);
      activeSession.updateBadge();
      window.addEventListener('scroll', activeSession.onScroll, true);
      window.addEventListener('resize', activeSession.onResize, true);
      return activeSession;
    }

    function endSession() {
      if (!activeSession) return;
  document.removeEventListener("keydown", activeSession.keydown, true);
  document.removeEventListener("beforeinput", activeSession.beforeInput as any, true);
  document.removeEventListener("selectionchange", activeSession.onSelectionChange, true);
      // Clean badge
      try {
        if (activeSession.badgeTimer) window.clearInterval(activeSession.badgeTimer);
        activeSession.badgeEl.remove();
      } catch {}
      try {
        window.removeEventListener('scroll', activeSession.onScroll, true);
        window.removeEventListener('resize', activeSession.onResize, true);
      } catch {}
      // Restore DOM by replacing each fragment with its text content
      for (const fragment of activeSession.fragments) {
        const text = fragment.textContent ?? "";
        const textNode = document.createTextNode(text);
        fragment.parentNode?.replaceChild(textNode, fragment);
      }
      activeSession = null;
      // Clear selection to avoid residual highlight
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
    }

    function isEditable(node: Node | null): boolean {
      if (!node) return false;
      const el =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement;
      if (!el) return false;
      const editable = el.closest(
        'input, textarea, [contenteditable="true"], [contenteditable=""]'
      );
      return !!editable;
    }

    function simpleToast(message: string) {
      console.warn("[TypeOver]", message);
      try {
        alert(message);
      } catch {}
    }
  },
});
