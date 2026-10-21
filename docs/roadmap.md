# Roadmap — FetLife Technicolor Elephants

## Current State (v0.4.0)

- 21 categorized technicolor elephant images across 8 categories
- Configurable NSFW threshold (default 0.70), persisted via GM storage
- In-page settings panel with:
  - Test replace / reset stats
  - Category picker with 8 built-in categories
  - Threshold slider
  - Custom elephant URLs (add/remove/list via UI) [#3]
  - Settings export/import (JSON) [#4]
  - Undo last replacement button [#5]
  - Enable Animations toggle (fade in/out with reduced-motion respect) [#6]
  - Allowed Domains / Blocked Domains lists [#2]
- **Stats HUD on toggle button** — live replacement-count badge [#7]
- **Accessible UI** — dialog semantics, labelled controls, live regions, focus trap, Escape-to-close, focus restore, visible focus rings, reduced-motion styles [#8]
- Analytics (replacements, by category, by confidence bucket)
- Keyboard shortcuts:
  - `Ctrl+Shift+E` toggle
  - `Ctrl+Shift+R` cycle style
  - `Ctrl+Shift+T` open settings
  - `Ctrl+Shift+U` undo last replacement [#5]
- **Performance: IntersectionObserver + debounced MutationObserver** — only classifies visible images, 30s cooldown per image [#1]
- 100 unit + integration + userscript tests passing
- Storage abstraction (`GM_getValue`/`GM_setValue` with in-memory test fallback)

## Next Major Enhancements

| # | Enhancement | Description | Priority | Est. Effort |
|---|-------------|-------------|----------|-------------|
| 10 | **Dark mode settings panel** | Detect prefers-color-scheme or add theme toggle for the in-page settings UI | Low | Small |
| 9 | **False-positive reporting** | One-click "this wasn't NSFW" feedback that logs to analytics and temporarily whitelists the image URL | Low | Medium |
| 11 | **Scheduled activation window** | Only run during user-defined hours (e.g., 9am–5pm) with a per-day schedule | Low | Medium |
| 12 | **Test coverage: integration with mock model** | Add Jest integration tests that stub nsfwjs.classify and assert DOM replacement behavior | Low | Medium |

## Completed Enhancements

| # | Enhancement | Description |
|---|-------------|-------------|
| 3 | **Custom elephant URLs via settings UI** | Users can add/remove their own elephant image URLs from the in-page settings panel; mixed 50/50 with built-in when category selected |
| 4 | **Settings export/import (JSON)** | Backup and restore all settings + custom elephant URLs as a JSON file via clipboard or textarea |
| 1 | **Performance: IntersectionObserver + debounce** | Only classifies images near viewport; debounced MutationObserver (500ms); 30s cooldown per image |
| 5 | **Undo last replacement** | Restore the original `src` of the most recently replaced image (per-session history stack, max 50); keyboard shortcut `Ctrl+Shift+U` |
| 6 | **Replacement animation** | Fade-out → swap src → fade-in transition (0.3s); disabled via settings or `prefers-reduced-motion` |
| 7 | **Stats HUD on toggle button** | Live badge on the corner button showing total replacements; updates live and resets with stats |
| 2 | **Domain allowlist/blocklist** | Per-domain control: allowlist (blank = all), blocklist takes precedence; supports `example.com` and `*.example.com` patterns; script exits early on disallowed domains |
| 8 | **Accessibility (ARIA + keyboard nav)** | `role="dialog"` + `aria-labelledby`; every control has an associated `<label for>`; `role="status"` live regions for stats and import feedback; focus moves into the panel on open and returns to the toggle button on close; Tab/Shift+Tab focus trap; Escape to close; visible `:focus-visible` rings; `prefers-reduced-motion` stylesheet |

## Notes

- Items 10-12 remain. #10 (dark mode) is the cheapest remaining win and pairs well with the accessibility work.
- Item 12 is partially satisfied already: `tests/userscript.test.js` evaluates the real userscript in jsdom and asserts UI behaviour, and `tests/integration.test.js` stubs `nsfwjs.classify`.
- Recommended next order: 10 → 9 → 11 → 12.