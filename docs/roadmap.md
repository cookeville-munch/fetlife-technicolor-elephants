# Roadmap — FetLife Technicolor Elephants

## Current State (v0.4.5)

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
  - Theme toggle (auto/light/dark) [#10]
  - Schedule activation window (start/end time, days of week) [#11]
- **Stats HUD on toggle button** — live replacement-count badge [#7]
- **Accessible UI** — dialog semantics, labelled controls, live regions, focus trap, Escape-to-close, focus restore, visible focus rings, reduced-motion styles [#8]
- **False-positive reporting** — click the ✗ overlay on a replaced elephant to whitelist it for 7 days and log to analytics [#9]
- Analytics (replacements, by category, by confidence bucket, false-positive reports, schedule bypass count, time-of-day stats)
- Keyboard shortcuts:
  - `Ctrl+Shift+E` toggle
  - `Ctrl+Shift+R` cycle style
  - `Ctrl+Shift+T` open settings
  - `Ctrl+Shift+U` undo last replacement [#5]
- **Performance: IntersectionObserver + debounced MutationObserver** — only classifies visible images, 30s cooldown per image [#1]
- **Self-hosted NSFW model** — MobileNetV2 model files committed to repo (`model/`), eliminates external CDN dependency that fails in userscript sandboxes
- **CORS-safe image loading** — `fetchImageAsImageBitmap()` uses `GM_xmlhttpRequest` to bypass cross-origin restrictions, then creates an `ImageBitmap` from a Blob; no canvas tainting, works with any CDN
- 111 unit + integration + userscript tests passing
- Storage abstraction (`GM_getValue`/`GM_setValue` with in-memory test fallback)

## Next Major Enhancements

No remaining items. All enhancements from the roadmap are complete.

## Completed Enhancements

| # | Enhancement | Description |
|---|-------------|-------------|
| 15 | **Robust image decoding** | `fetchImageAsImageBitmap()` removes MIME type hint from Blob (which caused `InvalidStateError: The source image could not be decoded` when the hint mismatched the actual format). Falls back to an `Image` element if `createImageBitmap` fails — handles WebP and other formats `createImageBitmap` rejects, still same-origin/no tainting. |
| 14 | **CORS-safe image loading** | `fetchImageAsImageBitmap()` uses `GM_xmlhttpRequest` to bypass cross-origin restrictions, then creates an `ImageBitmap` from a Blob — no canvas tainting, works with any CDN. Fixes `SecurityError: Failed to execute 'texSubImage2D'`. |
| 13 | **Self-hosted NSFW model** | Model files (`model/model.json`, `model/group1-shard1of1`) committed to repo; primary URL points to `raw.githubusercontent.com/cookeville-munch/.../model/model.json`; falls back to upstream nsfwjs model. Fixes `ERR_NAME_NOT_RESOLVED` in userscript sandboxes where cloudfront.net model URL was dead. |
| 12 | **Integration tests with a mock NSFW model** | `tests/integration.test.js` stubs `nsfwjs.classify` with a mock model and asserts DOM replacement behavior for Porn/Hentai/Sexy/Neutral classifications, threshold edge cases, error handling, concurrent processing, `replaceWithElephant`, and `undoLastReplacement` LIFO ordering |
| 10 | **Dark mode settings panel** | Auto-detects `prefers-color-scheme`; manual Light/Dark toggle in the panel; injects theme-aware CSS for the settings panel, stats box, and help text |
| 9 | **False-positive reporting** | One-click "✗" overlay on replaced elephants reports the image as a false positive; logs to `falsePositiveReports` analytics; whitelists the original src for 7 days (configurable) so it is never re-replaced |
| 11 | **Scheduled activation window** | Toggle to enable a start/end time + days-of-week schedule; `isWithinSchedule()` supports overnight windows (e.g. 22:00-06:00); script exits early with a `scheduleBypassCount` log when outside the window; `getScheduleInfo()` returns a human-readable status for the panel |
| 3 | **Custom elephant URLs via settings UI** | Users can add/remove their own elephant image URLs from the in-page settings panel; mixed 50/50 with built-in when category selected |
| 4 | **Settings export/import (JSON)** | Backup and restore all settings + custom elephant URLs as a JSON file via clipboard or textarea |
| 1 | **Performance: IntersectionObserver + debounce** | Only classifies images near viewport; debounced MutationObserver (500ms); 30s cooldown per image |
| 5 | **Undo last replacement** | Restore the original `src` of the most recently replaced image (per-session history stack, max 50); keyboard shortcut `Ctrl+Shift+U` |
| 6 | **Replacement animation** | Fade-out → swap src → fade-in transition (0.3s); disabled via settings or `prefers-reduced-motion` |
| 7 | **Stats HUD on toggle button** | Live badge on the corner button showing total replacements; updates live and resets with stats |
| 2 | **Domain allowlist/blocklist** | Per-domain control: allowlist (blank = all), blocklist takes precedence; supports `example.com` and `*.example.com` patterns; script exits early on disallowed domains |
| 8 | **Accessibility (ARIA + keyboard nav)** | `role="dialog"` + `aria-labelledby`; every control has an associated `<label for>`; `role="status"` live regions for stats and import feedback; focus moves into the panel on open and returns to the toggle button on close; Tab/Shift+Tab focus trap; Escape to close; visible `:focus-visible` rings; `prefers-reduced-motion` stylesheet |

## Notes

- All 15 roadmap items are complete. The project is feature-complete at v0.4.5.
- The `storage` abstraction in `src/main.js` now has a real in-memory fallback (`_memoryStore`) so persistence works in tests without `GM_*` globals.