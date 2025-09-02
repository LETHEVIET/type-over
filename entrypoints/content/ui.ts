export function ensureUiRoot() {
  let host = document.getElementById("typeover-ui-host") as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = "typeover-ui-host";
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .typeover-toast {
        position: fixed;
        left: 50%;
        bottom: 20px;
        transform: translateX(-50%);
        background: rgba(17,24,39,0.95);
        color: #e5e7eb;
        border: 1px solid #374151;
        padding: 8px 12px;
        border-radius: 8px;
        font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        pointer-events: auto;
      }
      .typeover-hud {
        position: fixed;
        z-index: 1;
        background: rgba(17,24,39,0.9);
        color: #e5e7eb;
        border: 1px solid #374151;
        border-radius: 10px;
        padding: 8px 10px;
        font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        white-space: nowrap;
        pointer-events: none;
      }
    `;
    shadow.appendChild(style);
    (host as any)._shadow = shadow as ShadowRoot;
  }
  const shadow = ((host as any)._shadow as ShadowRoot) ?? host.shadowRoot!;
  return { host, shadow };
}

export function showToast(message: string, timeout = 2500) {
  const { shadow } = ensureUiRoot();
  const toast = document.createElement("div");
  toast.className = "typeover-toast";
  toast.textContent = message;
  shadow.appendChild(toast);
  window.setTimeout(() => toast.remove(), timeout);
}

export function createHud(): HTMLDivElement {
  const { shadow } = ensureUiRoot();
  const el = document.createElement('div');
  el.id = 'typeover-hud';
  el.className = 'typeover-hud';
  shadow.appendChild(el);
  return el as HTMLDivElement;
}
