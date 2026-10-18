# FetLife Technicolor Elephants

A Tampermonkey script designed to replace images identified as sexually explicit on FetLife.com with delightful pictures of tiny technicolor elephants.

## Features

*   **Client-Side NSFW Detection:** Utilizes the [NSFW.js](https://github.com/infinitered/nsfwjs) library to classify images directly within your browser.
*   **Technicolor Elephant Replacement:** Replaces identified explicit images with a randomly selected technicolor elephant image.
*   **Dynamic Content Handling:** Automatically processes images loaded dynamically (e.g., through infinite scrolling) to ensure comprehensive filtering.
*   **Performance Optimized:** Leverages the WebAssembly (WASM) backend of TensorFlow.js for improved performance in image classification.

## How It Works

This script integrates NSFW.js, a TensorFlow.js-based library, to perform client-side image analysis. When you visit FetLife.com, the script does the following:

1.  **Loads NSFW.js Model:** It loads a pre-trained machine learning model (MobileNetV2, running on the WASM backend) into your browser.
2.  **Scans Images:** It iterates through `<img>` elements on the page, both initially loaded and those added dynamically.
3.  **Classifies Content:** Each image is passed to the NSFW.js model, which classifies its content into categories such as `Porn`, `Hentai`, `Sexy`, `Neutral`, and `Drawing`.
4.  **Replaces Explicit Images:** If an image's classification confidence for `Porn`, `Hentai`, or `Sexy` exceeds a configurable threshold (currently 70%), the script replaces its `src` attribute with a URL pointing to a technicolor elephant image.

## Installation

To use this script, you will need a user script manager like [Tampermonkey](https://www.tampermonkey.net/) (available for Chrome, Firefox, Edge, Safari).

1.  **Install Tampermonkey:** If you don't have it already, install the Tampermonkey browser extension for your browser.
2.  **Install the User Script:**
    *   Go to the raw script file on GitHub: [`fetlife-technicolor-elephants.user.js`](https://github.com/elijah/fetlife-technicolor-elephants/blob/master/fetlife-technicolor-elephants.user.js)
    *   Click on the "Raw" button to view the raw script content.
    *   Tampermonkey should detect the `.user.js` file and prompt you to install it. Confirm the installation.

## Usage

Simply navigate to [FetLife.com](https://fetlife.com/) after installing the script. Images identified as explicit will be automatically replaced with technicolor elephants. You can open your browser's developer console (usually F12) to see `console.log` messages indicating when the model loads and when images are replaced.

## Configuration & Customization

*   **Elephant Images:** The script uses a curated collection of 7 technicolor elephant images from Wikimedia Commons and Instagram. You can preview all of them in the [elephant gallery](docs/elephant-gallery.md). To customize or add more variety, you can edit the script (via Tampermonkey's dashboard) and update the `elephantImages` array with direct URLs to your preferred elephant images.
*   **Detection Threshold:** The `probability > 0.7` threshold for NSFW detection can be adjusted in the script. A lower value might catch more images but could lead to more false positives. A higher value might miss some explicit content but reduce false positives.
*   **Image Selectors:** For advanced users, the script currently processes all `<img>` tags. You could refine the `document.querySelectorAll('img')` selector to target more specific image containers or elements on FetLife that are likely to hold user-uploaded content, potentially improving performance and accuracy.

## Disclaimer

This script is experimental and relies on an AI model for classification. While NSFW.js is generally accurate, it is not perfect and may result in false positives (replacing non-explicit images) or false negatives (missing explicit images). It may also consume noticeable browser resources due to client-side machine learning. Use at your own discretion.

## Future Improvements

*   Allow user configuration of settings (e.g., threshold, elephant image URLs) directly within the Tampermonkey menu.
*   Optimize image scanning to reduce resource usage.