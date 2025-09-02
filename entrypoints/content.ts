export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("TypeOver content ready.");

    // Session state
    let activeSession: null | {
      chars: Array<{ el: HTMLSpanElement; ch: string }>;
      fragments: HTMLSpanElement[];
      index: number;
      keydown: (e: KeyboardEvent) => void;
      caretEl: HTMLDivElement;
      blinkTimer: number | null;
      updateCaret: () => void;
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
      activeSession = createInlinePractice(range);
      if (!activeSession) return;
      // Remove selection highlight to avoid blue overlay during practice
      try {
        sel.removeAllRanges();
      } catch {}
      document.addEventListener("keydown", activeSession.keydown, true);
    }

    function createInlinePractice(range: Range) {
      const affectedFragments: HTMLSpanElement[] = [];
      const charList: Array<{ el: HTMLSpanElement; ch: string }> = [];

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
          charList.push({ el: charEl, ch });
        }
        affectedFragments.push(fragment);
      }

      // Create a blinking caret indicator positioned at current index
      const caretEl = document.createElement('div');
      caretEl.id = 'typeover-caret';
      Object.assign(caretEl.style, {
        position: 'fixed',
        width: '2px',
        background: '#3b82f6',
        zIndex: '2147483647',
        pointerEvents: 'none',
        transition: 'top 40ms linear, left 40ms linear, height 40ms linear',
      } as CSSStyleDeclaration);
      document.body.appendChild(caretEl);

      let visible = true;
      const blinkTimer = window.setInterval(() => {
        visible = !visible;
        caretEl.style.opacity = visible ? '1' : '0';
      }, 500);

      const updateCaret = () => {
        const i = activeSession?.index ?? 0;
        const charsArr = activeSession?.chars ?? charList;
        if (charsArr.length === 0) return;
        // Prefer positioning after previous char, otherwise before current
        const prevIdx = Math.max(0, i - 1);
        let baseRect = charsArr[Math.min(prevIdx, charsArr.length - 1)].el.getBoundingClientRect();
        let left = baseRect.left + (i > 0 ? baseRect.width : 0);
        let top = baseRect.top;
        let height = Math.max(16, baseRect.height || 16);
        // If degenerate rect (e.g., newline), try current char
        if (baseRect.width < 0.5 && i < charsArr.length) {
          const curRect = charsArr[i].el.getBoundingClientRect();
          if (curRect.width >= 0.5 || curRect.height >= 8) {
            left = curRect.left;
            top = curRect.top;
            height = Math.max(16, curRect.height || 16);
          }
        }
        caretEl.style.left = `${Math.max(0, left)}px`;
        caretEl.style.top = `${Math.max(0, top)}px`;
        caretEl.style.height = `${height}px`;
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
        if (e.key === "Backspace") {
          if (!activeSession) return;
          if (activeSession.index > 0) {
            e.preventDefault();
            e.stopPropagation();
            activeSession.index--;
            const { el } = activeSession.chars[activeSession.index];
            // Reset to gray
            el.style.color = "#9ca3af";
          }
          return;
        }

        // Only handle printable characters
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!activeSession) return;

        e.preventDefault();
        e.stopPropagation();

        const i = activeSession.index;
        if (i >= activeSession.chars.length) return finishSession();
        const { el, ch } = activeSession.chars[i];
        const expected = normalizeChar(ch);
        const got = normalizeChar(e.key);
  if (got === expected) {
          // Correct: remove gray style to reveal original color
          el.style.removeProperty("color");
        } else {
          // Incorrect: mark red
          el.style.color = "#ef4444";
        }
        activeSession.index++;
        if (activeSession.index >= activeSession.chars.length) {
          finishSession();
        }
  activeSession.updateCaret();
      };

      function finishSession() {
        endSession();
      }

      function normalizeChar(c: string) {
        // Treat all whitespace as a single space
        return /\s/.test(c) ? " " : c;
      }

      const onScroll = () => updateCaret();
      const onResize = () => updateCaret();

      activeSession = {
        chars: charList,
        fragments: affectedFragments,
        index: 0,
        keydown,
        caretEl,
        blinkTimer,
        updateCaret,
        onScroll,
        onResize,
      };
      // Initial caret placement and listeners
      activeSession.updateCaret();
      window.addEventListener('scroll', activeSession.onScroll, true);
      window.addEventListener('resize', activeSession.onResize, true);
      return activeSession;
    }

    function endSession() {
      if (!activeSession) return;
      document.removeEventListener("keydown", activeSession.keydown, true);
      window.removeEventListener('scroll', activeSession.onScroll, true);
      window.removeEventListener('resize', activeSession.onResize, true);
      if (activeSession.blinkTimer) window.clearInterval(activeSession.blinkTimer);
      activeSession.caretEl.remove();
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
