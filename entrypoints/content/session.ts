import { normalizeChar, formatDuration } from "./utils";
import { createHud, showToast } from "./ui";
import type { Preferences } from "../shared/prefs";

export type CharItem = { el: HTMLSpanElement; ch: string; text: Text | null; status: 0 | 1 | -1 };

export class TypeOverSession {
  chars: CharItem[] = [];
  fragments: HTMLSpanElement[] = [];
  index = 0;
  startTime = Date.now();
  private typedCount = 0;
  private correctCount = 0;
  private badgeTimer: number | null = null;
  private rafId: number | null = null;
  readonly abortController = new AbortController();
  readonly badgeEl: HTMLDivElement;

  constructor(private range: Range, private prefs?: Preferences) {
    this.badgeEl = createHud();
  }

  init(): boolean {
    const { fragments, chars } = this.wrapSelectionIntoFragments(this.range);
    if (fragments.length === 0) return false;
    this.fragments = fragments;
    this.chars = chars;
    // Apply preferences
    if (this.prefs) {
      // HUD opacity
      const baseBg = 0.9;
      const o = typeof this.prefs.opacity === 'number' ? this.prefs.opacity : baseBg;
      this.badgeEl.style.background = `rgba(17,24,39,${o})`;
      // Fragment font size
      if (this.prefs.fontSize) {
        for (const frag of this.fragments) frag.style.fontSize = `${this.prefs.fontSize}px`;
      }
    }
    // HUD
    this.updateBadge();
    this.badgeTimer = window.setInterval(() => this.updateBadge(), 1000);
    // Listeners
    document.addEventListener("keydown", this.keydown, { capture: true, signal: this.abortController.signal });
    document.addEventListener("beforeinput", this.beforeInput as any, { capture: true, signal: this.abortController.signal } as AddEventListenerOptions);
    document.addEventListener("selectionchange", this.onSelectionChange, { capture: true, signal: this.abortController.signal });
    window.addEventListener("scroll", this.onScroll, { capture: true, signal: this.abortController.signal });
    window.addEventListener("resize", this.onResize, { capture: true, signal: this.abortController.signal });
    // Caret
    this.placeCaret(0);
    this.updateBadgePosition();
    return true;
  }

  dispose() {
    try { this.abortController.abort(); } catch {}
    try { if (this.rafId != null) cancelAnimationFrame(this.rafId); } catch {}
    try { if (this.badgeTimer) clearInterval(this.badgeTimer); } catch {}
    try { this.badgeEl.remove(); } catch {}
    for (const fragment of this.fragments) {
      const text = fragment.textContent ?? "";
      const textNode = document.createTextNode(text);
      fragment.parentNode?.replaceChild(textNode, fragment);
    }
    try { window.getSelection()?.removeAllRanges(); } catch {}
  }

  // Event handlers as arrow funcs to keep `this`
  keydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      this.finish();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      // reset state
      for (const item of this.chars) {
        item.status = 0;
        item.el.style.color = '#9ca3af';
      }
      this.index = 0;
      this.typedCount = 0;
      this.correctCount = 0;
      this.updateBadge();
      this.placeCaret(0);
      return;
    }
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault(); e.stopPropagation();
      this.finish();
    }
  };

  beforeInput = (e: InputEvent) => {
    const type = e.inputType;
    if (type === 'insertText') {
      const data = e.data ?? '';
      if (data.length !== 1) { e.preventDefault(); return; }
      e.preventDefault();
      const i = this.index;
      if (i >= this.chars.length) { this.finish(); return; }
      const item = this.chars[i];
      const { el, ch } = item;
      const expected = normalizeChar(ch);
      const got = normalizeChar(data);
      if (got === expected) {
        el.style.removeProperty('color');
        item.status = 1;
        this.correctCount++;
        this.playTone('ok');
      } else {
        el.style.color = '#ef4444';
        item.status = -1;
        this.playTone('err');
      }
      this.typedCount++;
      this.index++;
      if (this.index >= this.chars.length) { this.finish(); return; }
      this.placeCaret(this.index);
      this.updateBadge();
      return;
    }
    if (type === 'deleteContentBackward') {
      e.preventDefault();
      if (this.index > 0) {
        this.index--;
        const item = this.chars[this.index];
        const { el } = item;
        el.style.color = '#9ca3af';
        if (item.status !== 0) {
          this.typedCount = Math.max(0, this.typedCount - 1);
          if (item.status === 1) this.correctCount = Math.max(0, this.correctCount - 1);
          item.status = 0;
        }
        this.placeCaret(this.index);
        this.updateBadge();
      }
      return;
    }
    if (type === 'insertLineBreak') {
      e.preventDefault();
      this.finish();
      return;
    }
    e.preventDefault();
  };

  onSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const anchor = sel.anchorNode; if (!anchor) return;
    const frag = (anchor instanceof Element ? anchor : anchor.parentElement)?.closest('.typeover-fragment');
    if (!frag) return;
    const container = sel.anchorNode as Node;
    let el: HTMLElement | null = container instanceof Element ? (container as HTMLElement) : container.parentElement;
    if (!el) return;
    const charEl = el.closest('.typeover-char') as HTMLSpanElement | null;
    if (!charEl) return;
    const idx = this.chars.findIndex((c) => c.el === charEl);
    if (idx === -1) return;
    const offset = sel.anchorOffset;
    this.index = Math.min(this.chars.length, idx + (offset > 0 ? 1 : 0));
  };

  onScroll = () => this.scheduleBadgeUpdate();
  onResize = () => this.scheduleBadgeUpdate();

  private scheduleBadgeUpdate() {
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateBadgePosition();
    });
  }

  private wrapSelectionIntoFragments(range: Range) {
    const affectedFragments: HTMLSpanElement[] = [];
    const charList: CharItem[] = [];
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.textContent) return NodeFilter.FILTER_REJECT;
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          const intersects =
            range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
            range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
          nodeRange.detach?.();
          return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      }
    );

    const segments: Array<{ node: Text; start: number; end: number }> = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.data.length;
      let start = 0; let end = len;
      if (node === range.startContainer) start = range.startOffset;
      if (node === range.endContainer) end = range.endOffset;
      if (start >= end) continue;
      segments.push({ node, start, end });
    }

    for (const { node, start, end } of segments) {
      let target = node;
      if (start > 0) target = target.splitText(start);
      const spanLen = end - start;
      if (spanLen < target.data.length) target.splitText(spanLen);

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
        charEl.style.color = "#9ca3af";
        fragment.appendChild(charEl);
        charList.push({ el: charEl, ch, text: charEl.firstChild as Text, status: 0 });
      }
      affectedFragments.push(fragment);
    }

    return { fragments: affectedFragments, chars: charList };
  }

  private wpm(): number {
    const elapsedMs = Math.max(1, Date.now() - this.startTime);
    const minutes = elapsedMs / 60000;
    return minutes > 0 ? Math.round((this.correctCount / 5) / minutes) : 0;
  }

  private accuracy(): number {
    return this.typedCount > 0 ? Math.round((this.correctCount / this.typedCount) * 100) : 100;
  }

  private progress(): number {
    const total = this.chars.length || 1;
    const pct = Math.round((this.index / total) * 100);
    return Math.max(0, Math.min(100, pct));
  }

  updateBadge() {
    const elapsed = formatDuration(Date.now() - this.startTime);
    const prog = this.progress();
  this.badgeEl.textContent = `WPM ${this.wpm()} · Acc ${this.accuracy()}% · ${elapsed} · ${prog}% · Enter to finish · Esc to exit`;
  }

  private computeBoundingRect() {
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const frag of this.fragments) {
      const r = frag.getBoundingClientRect();
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    return { left, right, top, bottom };
  }

  updateBadgePosition() {
    if (this.fragments.length === 0) return;
    const { left, bottom } = this.computeBoundingRect();
    const pad = 8;
    this.badgeEl.style.left = `${Math.max(0, left)}px`;
    this.badgeEl.style.top = `${Math.max(0, bottom + pad)}px`;
  }

  placeCaret(i: number) {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    const range = document.createRange();
    const list = this.chars;
    if (list.length === 0) return;
    if (i <= 0) {
      const first = list[0];
      const tn = first.text; tn ? range.setStart(tn, 0) : range.setStartBefore(first.el);
    } else if (i >= list.length) {
      const last = list[list.length - 1];
      const tn = last.text; tn ? range.setStart(tn, tn.length) : range.setStartAfter(last.el);
    } else {
      const prev = list[i - 1];
      const tn = prev.text; tn ? range.setStart(tn, tn.length) : range.setStartAfter(prev.el);
    }
    range.collapse(true);
    sel.addRange(range);
    const currentEl = (i <= 0 ? this.chars[0].el : this.chars[Math.min(i, this.chars.length - 1)].el);
    const host = currentEl.closest('.typeover-fragment') as HTMLSpanElement | null;
    try { host?.focus({ preventScroll: true }); } catch { host?.focus(); }
    try { currentEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {}
    this.updateBadgePosition();
  }

  finish() {
  const wpm = this.wpm();
  const acc = this.accuracy();
  const elapsed = formatDuration(Date.now() - this.startTime);
  showToast(`WPM ${wpm} · Acc ${acc}% · ${elapsed}`);
    this.playTone('done');
  this.dispose();
  }

  private audioCtx: AudioContext | null = null;
  private playTone(kind: 'ok'|'err'|'done') {
    if (!this.prefs?.sound) return;
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      let freq = 440, dur = 0.06, vol = 0.03;
      if (kind === 'ok') { freq = 660; dur = 0.04; vol = 0.025; }
      if (kind === 'err') { freq = 220; dur = 0.08; vol = 0.035; }
      if (kind === 'done') { freq = 880; dur = 0.12; vol = 0.04; }
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.start(now);
      osc.stop(now + dur);
    } catch {}
  }
}
