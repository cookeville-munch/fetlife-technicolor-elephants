const tf = require('@tensorflow/tfjs');
const nsfwjs = require('nsfwjs');

/**
 * Array of technicolor elephant image URLs.
 * You can add more URLs here for variety.
 * Make sure these are direct links to images (e.g., .jpg, .png, .gif).
 */
const ELEPHANT_IMAGES = [
  'https://lookaside.instagram.com/seo/google_widget/crawler/?media_id=3832018732469719353', // Dumbo Pink Elephants from Instagram
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Dumbo_1941.png/640px-Dumbo_1941.png', // Dumbo (1941) - Public Domain
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Dumbo_and_Mrs_Jumbo.jpg/640px-Dumbo_and_Mrs_Jumbo.jpg', // Dumbo and Mrs Jumbo
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Pink_Elephants_on_Parade_from_Dumbo_%281941%29.png/640px-Pink_Elephants_on_Parade_from_Dumbo_%281941%29.png', // Pink Elephants on Parade
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Elephant_colorful_1.jpg/640px-Elephant_colorful_1.jpg', // Colorful Elephant Art
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Technicolor_Elephant_Dumbo_1941.png/640px-Technicolor_Elephant_Dumbo_1941.png', // Technicolor Dumbo Frame
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Pink_Elephant_Dumbo_1941.png/640px-Pink_Elephant_Dumbo_1941.png', // Pink Elephant Frame
];

/**
 * Probability threshold for NSFW detection. Images with a classification probability
 * higher than this value for 'Porn', 'Hentai', or 'Sexy' will be replaced.
 * Lowering this value might catch more images but could increase false positives.
 * Raising it might reduce false positives but could miss some explicit content.
 */
const NSFW_THRESHOLD = 0.7;

let nsfwModel;

/**
 * Loads the NSFW.js model and initializes the TensorFlow.js WASM backend.
 * This ensures the model is ready before attempting to classify images.
 */
async function loadModel() {
  console.log('FetLife Technicolor Elephants: Loading NSFW.js model...');
  try {
    tf.setBackend('wasm');
    await tf.ready();

    nsfwModel = await nsfwjs.load();
    console.log('FetLife Technicolor Elephants: NSFW.js model loaded successfully.');
    return nsfwModel;
  } catch (error) {
    console.error('FetLife Technicolor Elephants: Failed to load NSFW.js model:', error);
    throw error;
  }
}

/**
 * Determines if an image is classified as NSFW.
 * @param {Array} predictions - Array of prediction objects from NSFW.js model
 * @returns {boolean} - True if the image is NSFW based on threshold
 */
function isNSFW(predictions) {
  return predictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > NSFW_THRESHOLD);
}

/**
 * Gets a random elephant image URL from the available images.
 * @returns {string} - Random elephant image URL
 */
function getRandomElephantImage() {
  return ELEPHANT_IMAGES[Math.floor(Math.random() * ELEPHANT_IMAGES.length)];
}

/**
 * Replaces an image with a technicolor elephant image.
 * @param {HTMLElement} img - The image element to replace
 */
function replaceWithElephant(img) {
  const randomElephant = getRandomElephantImage();
  img.src = randomElephant;
  img.srcset = '';
  console.log('FetLife Technicolor Elephants: Replaced NSFW image with technicolor elephant.');
}

/**
 * Checks and replaces NSFW images in the given image element.
 * @param {HTMLElement} img - The image element to check and potentially replace
 * @returns {Promise} - Promise that resolves when the image is processed
 */
async function checkAndReplaceImage(img) {
  if (img.dataset.nsfwChecked || img.width < 50 || img.height < 50) {
    return;
  }
  img.dataset.nsfwChecked = 'true';

  try {
    const predictions = await nsfwModel.classify(img);
    const shouldReplace = isNSFW(predictions);

    if (shouldReplace) {
      replaceWithElephant(img);
    }
  } catch (error) {
    console.error('FetLife Technicolor Elephants: Error classifying image:', error);
  }
}

/**
 * Iterates through all image elements on the page, classifies them using NSFW.js,
 * and replaces explicit images with a technicolor elephant image.
 */
async function replacePenisImages() {
  if (!nsfwModel) {
    console.log('FetLife Technicolor Elephants: NSFW.js model not yet loaded, deferring image replacement.');
    return;
  }

  const images = document.querySelectorAll('img');
  const promises = Array.from(images).map(checkAndReplaceImage);
  await Promise.all(promises);
}

/**
 * Main entry point that initializes the script.
 */
async function initialize() {
  await loadModel();
  await replacePenisImages();

  const observer = new MutationObserver(replacePenisImages);
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Sets the NSFW model (for testing purposes).
 * @param {Object} model - The NSFW model to set
 */
function modifyModel(model) {
  nsfwModel = model;
}

module.exports = {
  loadModel,
  isNSFW,
  getRandomElephantImage,
  replaceWithElephant,
  checkAndReplaceImage,
  replacePenisImages,
  initialize,
  modifyModel,
  ELEPHANT_IMAGES,
  NSFW_THRESHOLD,
  nsfwModel,
};
