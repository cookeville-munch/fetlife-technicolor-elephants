// ==UserScript==
// @name         FetLife Technicolor Elephants
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Replaces images of penises on FetLife with pictures of tiny technicolor elephants using NSFW.js for detection.
// @author       You
// @match        https://fetlife.com/*
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@latest/dist/tf-backend-wasm.min.js
// @require      https://cdn.jsdelivr.net/npm/nsfwjs@latest/dist/nsfwjs.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Array of technicolor elephant image URLs
    const elephantImages = [
        'https://lookaside.instagram.com/seo/google_widget/crawler/?media_id=3832018732469719353' // Dumbo Pink Elephants from Instagram
    ];

    let nsfwModel; // Declare a variable to hold the loaded NSFW.js model

    async function loadModel() {
        console.log('Loading NSFW.js model...');
        try {
            // Set WASM backend for better performance
            tf.setBackend('wasm');
            await tf.ready();
            nsfwModel = await nsfwjs.load(); // Load the default MobileNetV2 model
            console.log('NSFW.js model loaded successfully.');
        } catch (error) {
            console.error('Failed to load NSFW.js model:', error);
            return;
        }
        // Once model is loaded, we can start processing images
        replacePenisImages();
    }

    async function replacePenisImages() {
        if (!nsfwModel) {
            console.log('NSFW.js model not yet loaded, deferring image replacement.');
            return; // Model not loaded yet
        }

        document.querySelectorAll('img').forEach(async img => {
            // Avoid reprocessing images or processing very small images
            if (img.dataset.nsfwChecked || img.width < 50 || img.height < 50) {
                return;
            }
            img.dataset.nsfwChecked = 'true'; // Mark as checked

            try {
                const predictions = await nsfwModel.classify(img);
                // Check for 'Porn', 'Hentai', or 'Sexy' categories
                const isNSFW = predictions.some(p => 
                    (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7
                );

                if (isNSFW) {
                    const randomElephant = elephantImages[Math.floor(Math.random() * elephantImages.length)];
                    img.src = randomElephant;
                    img.srcset = ''; // Clear srcset to ensure elephant image is used
                    console.log('Replaced NSFW image with technicolor elephant.');
                }
            } catch (error) {
                console.error('Error classifying image:', error);
            }
        });
    }

    // Run the model loading and then image replacement
    loadModel();

    // Observe for new elements being added to the DOM (e.g., infinite scroll)
    const observer = new MutationObserver(replacePenisImages);
    observer.observe(document.body, { childList: true, subtree: true });

})();