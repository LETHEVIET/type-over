# TypeOver — Practice typing on any web text

Turn any text you highlight on a webpage into a quick typing practice session. TypeOver overlays a lightweight practice UI right on top of the page you’re reading, so you can train with content you actually care about.

## What it does

- Highlight at least 20 words on any page
- Start practice via right‑click “Practice typing this text” or Alt+T
- Practice inline with a minimal overlay using Shadow DOM (no page CSS conflicts)
- Real‑time feedback:
  - Correct characters keep original page color
  - Incorrect characters are red
  - Cursor position indicator
- Metrics HUD: WPM, Accuracy, Time, Progress
- Simple controls: Esc to exit · Tab to restart · Enter to finish
- Popup settings: toggle sound, set overlay opacity, pick font size

## Quick start (from source)

Prerequisites:

- Node.js 18+ and pnpm

Install deps and start a dev build:

```sh
pnpm install
pnpm dev           # Chromium-based dev
# or
pnpm dev:firefox   # Firefox dev
```

Build production bundles and zips:

```sh
pnpm build
pnpm zip           # creates browser-specific zip(s)
```

## Load the extension

WXT prints the output directories on start/build. Typical locations are under `.output/` per browser.

### Chrome/Edge (unpacked)

1. Go to chrome://extensions
2. Enable “Developer mode”
3. Click “Load unpacked” and select the build output directory WXT shows for Chromium (e.g. `.output/chromium-mv3`)

### Firefox (temporary add-on)

1. Go to about:debugging#/runtime/this-firefox
2. Click “Load Temporary Add-on…”
3. Select the `manifest.json` inside the Firefox output directory WXT shows (e.g. under `.output/`)

## How to use

1. Browse normally. Highlight a passage (minimum 20 words).
2. Start practice:
   - Right‑click → “Practice typing this text”, or
   - Press Alt+T
3. Type over the text. Watch WPM, Accuracy, Time, and Progress in the HUD.
4. Controls:
   - Esc → exit practice
   - Tab → restart current text
   - Enter → finish and see results toast

## Settings (popup)

Click the extension toolbar icon to open settings:

- Sound effects: on/off
- Overlay opacity: adjust HUD/background transparency
- Font size: set fragment text size for readability

Settings are stored using `browser.storage` (sync when available, local otherwise).

## Permissions

- `activeTab` — interact with the current page selection
- `contextMenus` — add the “Practice typing this text” menu
- `storage` — save your preferences
- Host permissions: `<all_urls>` — needed to run on any page you choose to practice on

Privacy note: TypeOver runs fully client‑side and does not send your selection or metrics anywhere.

## Tech stack

- TypeScript + [WXT](https://wxt.dev) for cross‑browser extension tooling
- Content script with Shadow DOM overlay for isolation
- React in the popup for settings

## Repo structure (high‑level)

- `entrypoints/`
  - `background.ts` — context menu + keyboard command wiring
  - `content.ts` — content script entry; starts sessions from selection
  - `content/` — UI + session logic (HUD, keystroke handling, metrics)
  - `popup/` — React settings UI
  - `shared/prefs.ts` — persisted preferences
- `wxt.config.ts` — permissions, commands, modules

## Troubleshooting

- Shortcut not working? Make sure Alt+T isn’t overridden by the site/OS. You can trigger from the context menu as well.
- Selection inside inputs/editors: TypeOver skips editable fields; select page text instead.
- “Select at least 20 words” message: choose a longer passage for meaningful practice and metrics.
- HUD position: it anchors near the selected text block; if the page reflows, it updates on scroll/resize.

## Roadmap (post‑MVP)

- Practice history and progress over time
- Difficulty modes (capitalization, punctuation)
- Code mode with syntax characters
- Leaderboards for popular texts
- Export session data
- Multi‑language support
- Typing technique tutorials

---

Made with WXT. Contributions and feedback are welcome.
