// ==UserScript==
// @name         FetLife Technicolor Elephants
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Replaces images of penises on FetLife with pictures of tiny technicolor elephants.
// @author       You
// @match        https://fetlife.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Array of technicolor elephant image URLs
    const elephantImages = [
        // Placeholder URLs - replace with actual URLs of technicolor elephants
        'https://via.placeholder.com/150/FF00FF/FFFFFF?text=Elephant1',
        'https://via.placeholder.com/150/00FFFF/000000?text=Elephant2',
        'https://via.placeholder.com/150/FFFF00/000000?text=Elephant3'
    ];

    function replacePenisImages() {
        // This is a very basic placeholder for identifying images to replace.
        // A more robust solution would involve image analysis or more specific selectors.
        // For now, let's target images with certain characteristics or within specific contexts.

        // Example: Target all img tags for demonstration.
        // In a real scenario, you'd want to be much more selective.
        document.querySelectorAll('img').forEach(img => {
            // Simple heuristic: if the image's aspect ratio is indicative of a common "penis" photo.
            // This is highly unreliable and will likely replace many innocent images.
            // This needs significant refinement.
            const width = img.naturalWidth;
            const height = img.naturalHeight;

            if (width > 0 && height > 0) {
                const aspectRatio = width / height;
                // Just an example heuristic: very tall and thin or very wide and short images might be targeted.
                // This is purely illustrative and not effective for the stated goal.
                if (aspectRatio > 2 || aspectRatio < 0.5) {
                    const randomElephant = elephantImages[Math.floor(Math.random() * elephantImages.length)];
                    img.src = randomElephant;
                    img.srcset = randomElephant; // Update srcset as well if present
                }
            }
        });
    }

    // Run the replacement function once on page load
    replacePenisImages();

    // Observe for new elements being added to the DOM (e.g., infinite scroll)
    const observer = new MutationObserver(replacePenisImages);
    observer.observe(document.body, { childList: true, subtree: true });

})();