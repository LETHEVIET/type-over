# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.1.0] - 2025-09-03

First public MVP release of TypeOver — a browser extension that lets you practice typing on any web text in-place.

### Added

- Text selection & activation
  - Highlight any text (min ~20 words) and start practice via context menu: "Practice typing this text"
  - Keyboard shortcut to activate practice (default: Ctrl+T)
- Practice interface (overlay)
  - Semi-transparent overlay rendered with Shadow DOM to avoid page CSS conflicts
  - Original text shown in gray; typed text appears in real-time
  - Inline feedback: green for correct, red for incorrect, blinking caret for cursor
- Live metrics
  - Words Per Minute (WPM)
  - Accuracy percentage
  - Time elapsed
  - Progress bar for completion
- Simple controls
  - ESC to exit practice mode
  - Tab to restart the current passage
  - Enter to finish and view results
- Minimal settings (persisted)
  - Toggle keystroke/error sounds
  - Overlay opacity level
  - Font size for practice text
- Background integration
  - Context menu creation and keyboard shortcut handling
  - Preference storage using extension storage APIs

### Permissions

- activeTab — interact with the current page
- contextMenus — right-click entry point
- storage — save user preferences

### Notes

- Designed to be lightweight and non-intrusive; works across most webpages
- Built with WXT + React; overlay isolated via Shadow DOM to prevent style clashes

### Next candidates (post-MVP)

- Session history and progress tracking
- Difficulty modes (capitalization, punctuation challenges)
- Code-oriented practice mode
- Leaderboards and popular passages
- Export session data
- Multi-language support
- Typing technique tutorials

[0.1.0]: https://github.com/LETHEVIET/type-over/releases/tag/v0.1.0
