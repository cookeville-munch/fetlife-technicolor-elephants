// ==UserScript==
// @name         FetLife Technicolor Elephants
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Replaces images of penises on FetLife with pictures of tiny technicolor elephants using NSFW.js for detection.
// @author       You
// @match        https://fetlife.com/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@latest/dist/tf-backend-wasm.min.js
// @require      https://cdn.jsdelivr.net/npm/nsfwjs@latest/dist/nsfwjs.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Array of technicolor elephant image URLs.
    // You can add more URLs here for variety.
    // Make sure these are direct links to images (e.g., .jpg, .png, .gif).
    const elephantImages = [
        'https://lookaside.instagram.com/seo/google_widget/crawler/?media_id=3832018732469719353' // Dumbo Pink Elephants from Instagram
    ];

    // Probability threshold for NSFW detection. Images with a classification probability
    // higher than this value for 'Porn', 'Hentai', or 'Sexy' will be replaced.
    // Lowering this value might catch more images but could increase false positives.
    // Raising it might reduce false positives but could miss some explicit content.
    const NSFW_THRESHOLD = 0.7;

    let nsfwModel; // Variable to hold the loaded NSFW.js model.

    /**
     * Loads the NSFW.js model and initializes the TensorFlow.js WASM backend.
     * This ensures the model is ready before attempting to classify images.
     */
    async function loadModel() {
        console.log('FetLife Technicolor Elephants: Loading NSFW.js model...');
        try {
            // Set WASM backend for better performance. This is crucial for client-side ML.
            tf.setBackend('wasm');
            await tf.ready(); // Wait for the backend to be ready.
            
            // Load the default MobileNetV2 model. Other options include 'MobileNetV2Mid' or 'InceptionV3'.
            // MobileNetV2 offers a good balance of performance and accuracy for general NSFW detection.
            nsfwModel = await nsfwjs.load(); 
            console.log('FetLife Technicolor Elephants: NSFW.js model loaded successfully.');
            
            // Once the model is loaded, immediately process existing images on the page.
            replacePenisImages();
        } catch (error) {
            console.error('FetLife Technicolor Elephants: Failed to load NSFW.js model:', error);
            // If the model fails to load, subsequent image replacements will not occur.
        }
    }

    /**
     * Iterates through all image elements on the page, classifies them using NSFW.js,
     * and replaces explicit images with a technicolor elephant image.
     * This function is designed to be called on page load and whenever new elements are added to the DOM.
     */
    async function replacePenisImages() {
        // Ensure the NSFW.js model is loaded before attempting to classify images.
        if (!nsfwModel) {
            console.log('FetLife Technicolor Elephants: NSFW.js model not yet loaded, deferring image replacement.');
            return; // Model not loaded yet, defer processing.
        }

        // Select all image elements on the page.
        // For improved performance and accuracy, you might want to refine this selector
        // to target only images likely to contain user-uploaded content (e.g., specific CSS classes).
        document.querySelectorAll('img').forEach(async img => {
            // Skip images that have already been checked or are too small to be meaningful.
            // The 'nsfwChecked' dataset attribute prevents reprocessing the same image.
            // Adjust minimum width/height as needed.
            if (img.dataset.nsfwChecked || img.width < 50 || img.height < 50) {
                return;
            }
            img.dataset.nsfwChecked = 'true'; // Mark the image as checked.

            try {
                // Classify the image using the loaded NSFW.js model.
                // The model returns predictions for 5 categories: Drawing, Hentai, Neutral, Porn, Sexy.
                const predictions = await nsfwModel.classify(img);
                
                // Determine if the image is considered NSFW based on the threshold.
                // We are looking for 'Porn', 'Hentai', or 'Sexy' classifications.
                const isNSFW = predictions.some(p => 
                    (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > NSFW_THRESHOLD
                );

                if (isNSFW) {
                    // If classified as NSFW, replace the image with a random elephant image.
                    const randomElephant = elephantImages[Math.floor(Math.random() * elephantImages.length)];
                    img.src = randomElephant; // Set the new image source.
                    img.srcset = ''; // Clear srcset to ensure the new src is used and no other resolutions are loaded.
                    console.log('FetLife Technicolor Elephants: Replaced NSFW image with technicolor elephant.');
                }
            } catch (error) {
                console.error('FetLife Technicolor Elephants: Error classifying image:', error);
                // Continue processing other images even if one fails.
            }
        });
    }

    // Initiate the model loading process when the script starts.
    loadModel();

    // Set up a MutationObserver to watch for new image elements being added to the DOM.
    // This is essential for dynamically loaded content, such as infinite scrolls or modals.
    const observer = new MutationObserver(replacePenisImages);
    observer.observe(document.body, { childList: true, subtree: true });

})();