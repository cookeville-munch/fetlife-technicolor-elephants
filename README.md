# FetLife Technicolor Elephants

A Tampermonkey script designed to replace images identified as sexually explicit on FetLife.com with delightful pictures of tiny technicolor elephants.

## Features

- **Client-Side NSFW Detection:** Utilizes the [NSFW.js](https://github.com/infinitered/nsfwjs) library to classify images directly within your browser.
- **Technicolor Elephant Replacement:** Replaces identified explicit images with a randomly selected technicolor elephant image.
- **Dynamic Content Handling:** Automatically processes images loaded dynamically (e.g., through infinite scrolling) to ensure comprehensive filtering.
- **Performance Optimized:** Leverages the WebAssembly (WASM) backend of TensorFlow.js for improved performance in image classification, and only classifies images near the viewport.
- **Categorized Styles:** Eight built-in elephant categories (classic animation, pink elephants on parade, trunk action, neon & rainbow, pink & cute, Instagram, psychedelic, pop art, graffiti).
- **Configurable Threshold:** Adjust the NSFW detection sensitivity from the in-page settings panel.
- **Custom Elephant URLs:** Add your own elephant image URLs alongside the built-in library.
- **Domain Allow/Block Lists:** Control which sites the script runs on, with support for `example.com` and `*.example.com` patterns.
- **Undo:** Restore the original image of the most recent replacement.
- **Analytics:** Track replacement counts by category and confidence bucket.
- **Accessible UI:** Keyboard-navigable settings panel with ARIA semantics, focus management, and reduced-motion support.
- **Settings Export/Import:** Back up and restore your configuration as JSON.

## How It Works

This script integrates NSFW.js, a TensorFlow.js-based library, to perform client-side image analysis. When you visit FetLife.com, the script does the following:

1. **Loads NSFW.js Model:** It loads a pre-trained machine learning model (MobileNetV2, running on the WASM backend) into your browser.
2. **Scans Images:** It iterates through `<img>` elements on the page, both initially loaded and those added dynamically.
3. **Classifies Content:** Each image is passed to the NSFW.js model, which classifies its content into categories such as `Porn`, `Hentai`, `Sexy`, `Neutral`, and `Drawing`.
4. **Replaces Explicit Images:** If an image's classification confidence for `Porn`, `Hentai`, or `Sexy` exceeds the configured threshold (default 70%), the script replaces its `src` attribute with a URL pointing to a technicolor elephant image.

For performance, classification is deferred until an image is within 200px of the viewport, using an `IntersectionObserver`. DOM mutations are debounced (500ms), and each image is given a 30-second cooldown after processing.

## Installation

To use this script, you will need a user script manager like [Tampermonkey](https://www.tampermonkey.net/) (available for Chrome, Firefox, Edge, Safari).

1. **Install Tampermonkey:** If you don't have it already, install the Tampermonkey browser extension for your browser.
2. **Install the User Script:**
   - Go to the raw script file on GitHub: [`fetlife-technicolor-elephants.user.js`](https://github.com/elijah/fetlife-technicolor-elephants/blob/master/fetlife-technicolor-elephants.user.js)
   - Click on the "Raw" button to view the raw script content.
   - Tampermonkey should detect the `.user.js` file and prompt you to install it. Confirm the installation.

## Usage

Navigate to [FetLife.com](https://fetlife.com/) after installing the script. Images identified as explicit will be automatically replaced with technicolor elephants.

A pink elephant button appears in the bottom-right corner:

- The **badge** shows how many images have been replaced this session (across all sessions, stored locally).
- **Click** it (or press `Ctrl+Shift+T`) to open the settings panel.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Toggle replacements on/off |
| `Ctrl+Shift+R` | Cycle elephant style |
| `Ctrl+Shift+T` | Open/close the settings panel |
| `Ctrl+Shift+U` | Undo the last replacement |
| `Escape` | Close the settings panel |

## Configuration & Customization

All settings live in the in-page panel and persist across sessions via Tampermonkey storage.

- **Elephant Images:** The script ships with 21 technicolor elephant images across 8 categories. Preview them in the [elephant gallery](docs/elephant-gallery.md). You can also add your own image URLs via **Custom Elephant URLs** in the settings panel.
- **Detection Threshold:** The slider adjusts the confidence required before an image is replaced. Lower values catch more images (more false positives); higher values miss more explicit content (fewer false positives).
- **Elephant Style:** Choose a single category, or leave on *All Styles* for a random pick from every category.
- **Enable Animations:** Replacements fade out, swap, and fade back in. Turning this off (or using `prefers-reduced-motion`) applies the change instantly.
- **Allowed / Blocked Domains:** An empty allowlist means the script runs everywhere it is matched. The blocklist always wins over the allowlist.
- **Image Selectors:** For advanced users, the script currently processes all `<img>` tags. You could refine the `document.querySelectorAll('img')` selector in `src/main.js` to target more specific image containers or elements on FetLife that are likely to hold user-uploaded content, potentially improving performance and accuracy.

### Running on other sites

The userscript ships with `@match https://fetlife.com/*`. To enable it elsewhere, add your own `@match` line in the Tampermonkey dashboard (for example `@match https://example.com/*`), then use the allow/block lists to control which of those sites it activates on. The script exits before loading the NSFW model on any domain that is blocked.

## Disclaimer

This script is experimental and relies on an AI model for classification. While NSFW.js is generally accurate, it is not perfect and may result in false positives (replacing non-explicit images) or false negatives (missing explicit images). It may also consume noticeable browser resources due to client-side machine learning. Use at your own discretion.

## Development

```bash
npm install
npm test          # Jest unit, integration, and userscript UI tests
npm run lint      # ESLint (airbnb-base)
npm run docs      # Generate JSDoc documentation
```

- `src/main.js` — Core library (testable, no DOM assumptions beyond `document`)
- `fetlife-technicolor-elephants.user.js` — The installable userscript
- `tests/unit.test.js` — Core logic (thresholds, settings, analytics, categories, domains)
- `tests/integration.test.js` — DOM replacement flow with a mocked NSFW model
- `tests/userscript.test.js` — Evaluates the real userscript in jsdom to verify UI/accessibility behaviour
- `docs/roadmap.md` — Planned and completed enhancements
- `docs/elephant-gallery.md` — Visual gallery of every built-in elephant image
