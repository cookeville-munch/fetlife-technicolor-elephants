/* global GM_getValue, GM_setValue */
const tf = require('@tensorflow/tfjs');
const nsfwjs = require('nsfwjs');

/**
 * Storage abstraction that works in both Tampermonkey (GM_getValue/GM_setValue)
 * and Node.js/test environments (in-memory fallback).
 */
const storage = {
  get(key) {
    // eslint-disable-next-line camelcase
    if (typeof GM_getValue !== 'undefined') {
      try {
        // eslint-disable-next-line camelcase
        return GM_getValue(key);
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  },
  set(key, value) {
    // eslint-disable-next-line camelcase
    if (typeof GM_setValue !== 'undefined') {
      try {
        // eslint-disable-next-line camelcase
        GM_setValue(key, value);
      } catch (e) {
        // ignore
      }
    }
  },
};

/**
 * User-configurable script settings.
 * @typedef {Object} Settings
 * @property {number} nsfwThreshold - Confidence threshold for NSFW classification (0-1)
 * @property {string} selectedCategory - Elephant category key, or 'all'
 * @property {boolean} enabled - Whether replacements are active
 * @property {string[]} customElephantImages - User-supplied elephant image URLs
 * @property {boolean} enableAnimations - Whether to animate image replacements
 * @property {string[]} allowedDomains - Domains where script runs (empty = all except blocked)
 * @property {string[]} blockedDomains - Domains where script never runs
 */

/**
 * Categorized technicolor elephant image URLs.
 * @typedef {Object} ElephantCategories
 * @property {string[]} classicAnimation
 * @property {string[]} parade
 * @property {string[]} trunk
 * @property {string[]} neonRainbow
 * @property {string[]} pinkCute
 * @property {string[]} instagram
 * @property {string[]} psychedelic
 * @property {string[]} popArt
 * @property {string[]} graffiti
 */

/**
 * Mapping of categories to arrays of elephant image URLs.
 * @type {ElephantCategories}
 */
const ELEPHANT_CATEGORIES = {
  classicAnimation: [
    'https://i.imgur.com/kieuANAb.jpg', // Les Clark animation Dumbo part 3
    'https://i.imgur.com/b6FvQTyb.jpg', // John Lounsbery animation Dumbo
    'https://i.imgur.com/fQRLZg4b.jpg', // Bill Tytla animation Dumbo part 3
  ],
  parade: [
    'https://i.imgur.com/D1yFC5ab.jpg', // Pink Elephants on Parade!
    'https://i.imgur.com/LMrGVyIb.jpg', // Pink Elephants on parade!
    'https://i.imgur.com/i62w1Atb.jpg', // Pink Elephants On Parade
    'https://i.imgur.com/965XADOb.jpg', // Pink Elephants on Parade detail
    'https://i.imgur.com/u8nYce9b.jpg', // Pink Elephants on Parade
  ],
  trunk: [
    'https://i.imgur.com/WJ6nrGjb.jpg', // When I open my eyes, that better be your trunk, Dumbo
    'https://i.imgur.com/VGAgd3Zb.jpg', // Drunk trunk Dumbo
  ],
  neonRainbow: [
    'https://i.imgur.com/Flkpjb.jpg', // I'm a lurker. First post. Me. The Elephant. And the Rainbow.
    'https://i.imgur.com/9oNnlHEb.jpg', // Rainbow elephant!
    'https://i.imgur.com/smQpcm5b.jpg', // Circuit Playing Cards (Neon Green + Rainbow White)
  ],
  pinkCute: [
    'https://i.imgur.com/J9n8exdb.jpg', // Baby pink elephant
    'https://i.imgur.com/XiNlussb.jpg', // Adorable pink baby elephant
    'https://i.imgur.com/gctz7Rbb.jpg', // Trippy Pink Elephant
  ],
  instagram: [
    'https://lookaside.instagram.com/seo/google_widget/crawler/?media_id=3832018732469719353', // Dumbo Pink Elephants from Instagram
  ],
  psychedelic: [
    'https://i.imgur.com/C4h5l1tb.jpg', // Semi-psychedelic elephant I painted. Phycedelephant?
  ],
  popArt: [
    'https://i.imgur.com/Aoj9hGub.jpg', // Pop art elephant
    'https://i.imgur.com/fwVYwf8b.jpg', // Pop art elephant
  ],
  graffiti: [
    'https://i.imgur.com/dVLeZfgb.jpg', // Elephant graffiti wall
  ],
};

/**
 * Flat array of all elephant images (for backward compatibility).
 * @type {string[]}
 */
const ELEPHANT_IMAGES = Object.values(ELEPHANT_CATEGORIES).flat();

/**
 * Display names for elephant categories.
 * @type {Object<string, string>}
 */
const CATEGORY_LABELS = {
  classicAnimation: 'Classic Animation',
  parade: 'Pink Elephants on Parade',
  trunk: 'Trunk Action',
  neonRainbow: 'Neon & Rainbow',
  pinkCute: 'Pink & Cute',
  instagram: 'Instagram Pink Elephants',
  psychedelic: 'Psychedelic',
  popArt: 'Pop Art',
  graffiti: 'Graffiti & Street Art',
};

/**
 * Internal storage for the NSFW probability threshold.
 * @private
 */
let _nsfwThreshold = 0.7;

/**
 * Whether animations are enabled (respects prefers-reduced-motion).
 * @type {boolean}
 */
let _animationsEnabled = true;

/**
 * Sets whether animations are enabled.
 * @param {boolean} enabled
 */
function setAnimationsEnabled(enabled) {
  _animationsEnabled = enabled;
}

/**
 * Attempts to load a persisted threshold from storage (if available).
 * This is intended to be called in the userscript context where GM_getValue exists.
 * @returns {number} The threshold value (default 0.7 if not set or invalid)
 */
function loadNSFWThreshold() {
  const saved = storage.get('nsfwThreshold');
  if (saved !== undefined) {
    const num = parseFloat(saved);
    if (!Number.isNaN(num)) {
      _nsfwThreshold = num;
    }
  }
  return _nsfwThreshold;
}

/**
 * Saves the threshold to storage (if available).
 * @param {number} value - The threshold value to persist
 */
function saveNSFWThreshold(value) {
  _nsfwThreshold = value;
  try {
    storage.set('nsfwThreshold', value);
  } catch (e) {
    console.warn('Could not persist threshold via storage', e);
  }
}

/**
 * Gets the current NSFW probability threshold.
 * @returns {number} The threshold value
 */
function getNSFWThreshold() {
  return _nsfwThreshold;
}

/**
 * Sets the NSFW probability threshold and persists it.
 * @param {number} value - The threshold value (between 0 and 1)
 */
function setNSFWThreshold(value) {
  const num = parseFloat(value);
  if (!Number.isNaN(num) && num >= 0 && num <= 1) {
    saveNSFWThreshold(num);
  } else {
    console.warn('Invalid NSFW threshold value:', value);
  }
}

// Initialize threshold from storage on load
loadNSFWThreshold();

/** @type {Settings} */
let _settings = {
  nsfwThreshold: 0.7,
  selectedCategory: 'all',
  enabled: true,
  customElephantImages: [],
  enableAnimations: true,
  allowedDomains: [],
  blockedDomains: [],
};
function loadSettings() {
  const saved = storage.get('fte_settings');
  if (saved) {
    try {
      _settings = { ..._settings, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Could not load settings', e);
    }
  }
  // Sync threshold and animation settings with settings
  _nsfwThreshold = _settings.nsfwThreshold;
  _animationsEnabled = _settings.enableAnimations !== undefined ? _settings.enableAnimations : true;
  return _settings;
}

/**
 * Saves settings to GM storage or memory.
 */
function saveSettings() {
  try {
    storage.set('fte_settings', JSON.stringify(_settings));
  } catch (e) {
    console.warn('Could not save settings', e);
  }
}

/**
 * Gets current settings.
 * @returns {Settings}
 */
function getSettings() {
  return { ..._settings };
}

/**
 * Updates a setting and persists it.
 * @param {Partial<Settings>} updates
 */
function updateSettings(updates) {
  _settings = { ..._settings, ...updates };
  if (updates.nsfwThreshold !== undefined) {
    setNSFWThreshold(updates.nsfwThreshold);
  }
  if (updates.enableAnimations !== undefined) {
    setAnimationsEnabled(updates.enableAnimations);
  }
  if (updates.allowedDomains !== undefined || updates.blockedDomains !== undefined) {
    saveSettings();
  }
  saveSettings();
}

// ----- Custom Elephant Images -----

/**
 * Adds a custom elephant image URL to the pool.
 * @param {string} url - The URL to add
 * @returns {boolean} True if added, false if duplicate or invalid
 */
function addCustomElephantImage(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  const pool = _settings.customElephantImages || [];
  if (pool.includes(trimmed)) return false;
  pool.push(trimmed);
  _settings.customElephantImages = pool;
  saveSettings();
  return true;
}

/**
 * Removes a custom elephant image URL from the pool.
 * @param {string} url - The URL to remove
 * @returns {boolean} True if removed, false if not found
 */
function removeCustomElephantImage(url) {
  const pool = _settings.customElephantImages || [];
  const idx = pool.indexOf(url);
  if (idx === -1) return false;
  pool.splice(idx, 1);
  _settings.customElephantImages = pool;
  saveSettings();
  return true;
}

/**
 * Gets all custom elephant image URLs.
 * @returns {string[]}
 */
function getCustomElephantImages() {
  return [...(_settings.customElephantImages || [])];
}

// ----- Settings Export / Import -----

/**
 * Exports all settings as a JSON string.
 * @returns {string} JSON string of settings
 */
function exportSettings() {
  return JSON.stringify(_settings, null, 2);
}

/**
 * Imports settings from a JSON string.
 * @param {string} jsonString - JSON string to import
 * @returns {boolean} True if import succeeded, false otherwise
 */
function importSettings(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) return false;
    _settings = { ..._settings, ...parsed };
    if (parsed.nsfwThreshold !== undefined) {
      setNSFWThreshold(parsed.nsfwThreshold);
    }
    saveSettings();
    return true;
  } catch (e) {
    console.warn('Could not import settings', e);
    return false;
  }
}

/**
 * Analytics storage.
 * @typedef {Object} Analytics
 * @property {number} replacements
 * @property {Object<string, number>} byCategory
 * @property {Object<string, number>} byConfidence
 */

/** @type {Analytics} */
let _analytics = { replacements: 0, byCategory: {}, byConfidence: {} };

/**
 * Loads analytics from GM storage or memory.
 * @returns {Analytics}
 */
function loadAnalytics() {
  const saved = storage.get('fte_analytics');
  if (saved) {
    try {
      _analytics = JSON.parse(saved);
    } catch (e) {
      _analytics = { replacements: 0, byCategory: {}, byConfidence: {} };
    }
  }
  return _analytics;
}

/**
 * Saves analytics to GM storage or memory.
 */
function saveAnalytics() {
  try {
    storage.set('fte_analytics', JSON.stringify(_analytics));
  } catch (e) {
    console.warn('Could not save analytics', e);
  }
}

/**
 * Records a replacement event.
 * @param {string} [category] - The elephant category used
 * @param {number} [confidence] - The NSFW confidence score
 */
function recordReplacement(category, confidence) {
  _analytics.replacements += 1;
  if (category) {
    _analytics.byCategory[category] = (_analytics.byCategory[category] || 0) + 1;
  }
  if (confidence) {
    const bucket = Math.floor(confidence * 10) / 10;
    _analytics.byConfidence[bucket] = (_analytics.byConfidence[bucket] || 0) + 1;
  }
  saveAnalytics();
}

/**
 * Gets current analytics.
 * @returns {Analytics}
 */
function getAnalytics() {
  return { ..._analytics };
}

/**
 * Resets analytics.
 */
function resetAnalytics() {
  _analytics = { replacements: 0, byCategory: {}, byConfidence: {} };
  saveAnalytics();
}

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
  const threshold = getNSFWThreshold();
  return predictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > threshold);
}

/**
 * Gets a random elephant image URL from the available images.
 * @param {string} [category] - Optional category key to select from
 * @returns {string} - Random elephant image URL
 */
function getRandomElephantImage(category) {
  const pool = getCustomElephantImages();
  if (category && ELEPHANT_CATEGORIES[category]) {
    const categoryArray = ELEPHANT_CATEGORIES[category];
    if (pool.length > 0 && Math.random() < 0.5) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return categoryArray[Math.floor(Math.random() * categoryArray.length)];
  }
  const allImages = ELEPHANT_IMAGES.concat(pool);
  return allImages[Math.floor(Math.random() * allImages.length)];
}

/**
 * Undo history stack for image replacements.
 * Stores references to replaced images with their original src.
 * @type {Array<{img: HTMLElement, originalSrc: string}>}
 */
const _undoHistory = [];

const MAX_UNDO_HISTORY = 50;

/**
 * Checks if animations should be applied (considers user preference).
 * @returns {boolean}
 */
function areAnimationsEnabled() {
  if (typeof window !== 'undefined') {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
  }
  return _animationsEnabled;
}

/**
 * Replaces an image with a technicolor elephant image.
 * Records the original src for undo capability.
 * @param {HTMLElement} img - The image element to replace
 */
function replaceWithElephant(img) {
  const randomElephant = getRandomElephantImage();
  // Record original src before replacing for undo support
  _undoHistory.push({ img, originalSrc: img.src });
  if (_undoHistory.length > MAX_UNDO_HISTORY) {
    _undoHistory.shift();
  }

  if (areAnimationsEnabled()) {
    // Fade out → swap src → fade in
    const transitionStyle = img.style.transition;
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';
    img.addEventListener('transitionend', () => {
      // eslint-disable-next-line no-param-reassign
      img.src = randomElephant;
      img.srcset = '';
      img.style.opacity = '1';
      img.style.transition = transitionStyle;
      console.log('FetLife Technicolor Elephants: Replaced NSFW image with technicolor elephant.');
    }, { once: true });
  } else {
    img.src = randomElephant;
    img.srcset = '';
    console.log('FetLife Technicolor Elephants: Replaced NSFW image with technicolor elephant.');
  }
}

/**
 * Undoes the last image replacement, restoring the original src.
 * @returns {boolean} True if an undo was performed, false if nothing to undo
 */
function undoLastReplacement() {
  // Find the most recent entry whose image still exists in the DOM
  while (_undoHistory.length > 0) {
    const entry = _undoHistory.pop();
    if (entry.img && entry.img.isConnected && entry.img.src !== entry.originalSrc) {
      entry.img.src = entry.originalSrc;
      entry.img.srcset = '';
      // Mark as 'undone' (truthy) so the image is not immediately re-replaced
      entry.img.dataset.nsfwChecked = 'undone';
      console.log('FetLife Technicolor Elephants: Restored original image.');
      return true;
    }
  }
  console.log('FetLife Technicolor Elephants: Nothing to undo.');
  return false;
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
 * Debounced image replacement with IntersectionObserver viewport awareness.
 * Only classifies images that are at least partially visible, avoiding
 * expensive NSFW classification on off-screen or dynamically-added images
 * before they enter the viewport.
 */
let _replaceProcessing = false;
const _replaceCooldownMs = 30000;
const _replaceLastReplaced = new WeakMap();

async function replacePenisImages() {
  if (_replaceProcessing || !nsfwModel) {
    return;
  }

  _replaceProcessing = true;

  try {
    // Get visible images only via IntersectionObserver
    const visibleImages = [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleImages.push(entry.target);
          }
        });
        observer.disconnect();
      },
      {
        rootMargin: '200px',
        threshold: 0.1,
      },
    );

    // Observe all images; collect those that intersect
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      if (img.dataset.nsfwChecked) return;
      if (img.width < 50 || img.height < 50) return;
      observer.observe(img);
    });

    // Wait a brief moment for intersection checks
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // Process visible images
    const imagesToCheck = visibleImages.filter((img) => {
      const last = _replaceLastReplaced.get(img);
      if (last && Date.now() - last < _replaceCooldownMs) return false;
      return true;
    });

    if (imagesToCheck.length === 0) {
      _replaceProcessing = false;
      return;
    }

    const promises = Array.from(imagesToCheck).map(checkAndReplaceImage);
    await Promise.all(promises);

    // Record cooldown timestamps for replaced images
    imagesToCheck.forEach((img) => {
      _replaceLastReplaced.set(img, Date.now());
    });
  } catch (error) {
    console.error('FetLife Technicolor Elephants: Error during viewport-aware replacement:', error);
  } finally {
    _replaceProcessing = false;
  }
}

/**
 * Matches a hostname against a domain pattern.
 * Supports exact matches (`example.com`), implicit subdomain matches
 * (`example.com` matches `www.example.com`), and explicit wildcards
 * (`*.example.com` matches any subdomain but not the bare domain).
 * @param {string} hostname - The hostname to test
 * @param {string} pattern - The domain pattern to match against
 * @returns {boolean} True if the hostname matches the pattern
 */
function matchesDomain(hostname, pattern) {
  if (!hostname || !pattern) return false;
  const host = hostname.toLowerCase().trim();
  const pat = pattern.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!pat) return false;

  if (pat.startsWith('*.')) {
    const suffix = pat.slice(2);
    return host.endsWith(`.${suffix}`);
  }
  return host === pat || host.endsWith(`.${pat}`);
}

/**
 * Checks whether the given hostname is permitted by the domain allow/block lists.
 * Blocklist takes precedence over the allowlist. An empty allowlist means
 * "all domains allowed" (minus anything on the blocklist).
 * @param {string} [hostname] - The hostname to check. If omitted, returns true
 *   (caller must supply current hostname in browser context).
 * @returns {boolean} True if the script should run on this domain
 */
function isDomainAllowed(hostname) {
  const host = hostname || '';
  if (!host) return true;
  const settings = getSettings();
  const blocked = settings.blockedDomains || [];
  const allowed = settings.allowedDomains || [];

  // Blocklist wins
  if (blocked.some((pattern) => matchesDomain(host, pattern))) {
    return false;
  }

  // Empty allowlist = allow everywhere
  if (allowed.length === 0) {
    return true;
  }

  return allowed.some((pattern) => matchesDomain(host, pattern));
}

/**
 * Adds a domain to the allowlist.
 * @param {string} domain - The domain pattern to add
 * @returns {boolean} True if added, false if duplicate or invalid
 */
function addAllowedDomain(domain) {
  if (typeof domain !== 'string' || !domain.trim()) return false;
  const trimmed = domain.trim();
  const list = _settings.allowedDomains || [];
  if (list.includes(trimmed)) return false;
  list.push(trimmed);
  _settings.allowedDomains = list;
  saveSettings();
  return true;
}

/**
 * Removes a domain from the allowlist.
 * @param {string} domain - The domain pattern to remove
 * @returns {boolean} True if removed, false if not found
 */
function removeAllowedDomain(domain) {
  const list = _settings.allowedDomains || [];
  const idx = list.indexOf(domain);
  if (idx === -1) return false;
  list.splice(idx, 1);
  _settings.allowedDomains = list;
  saveSettings();
  return true;
}

/**
 * Gets the domain allowlist.
 * @returns {string[]}
 */
function getAllowedDomains() {
  return [...(_settings.allowedDomains || [])];
}

/**
 * Adds a domain to the blocklist.
 * @param {string} domain - The domain pattern to add
 * @returns {boolean} True if added, false if duplicate or invalid
 */
function addBlockedDomain(domain) {
  if (typeof domain !== 'string' || !domain.trim()) return false;
  const trimmed = domain.trim();
  const list = _settings.blockedDomains || [];
  if (list.includes(trimmed)) return false;
  list.push(trimmed);
  _settings.blockedDomains = list;
  saveSettings();
  return true;
}

/**
 * Removes a domain from the blocklist.
 * @param {string} domain - The domain pattern to remove
 * @returns {boolean} True if removed, false if not found
 */
function removeBlockedDomain(domain) {
  const list = _settings.blockedDomains || [];
  const idx = list.indexOf(domain);
  if (idx === -1) return false;
  list.splice(idx, 1);
  _settings.blockedDomains = list;
  saveSettings();
  return true;
}

/**
 * Gets the domain blocklist.
 * @returns {string[]}
 */
function getBlockedDomains() {
  return [...(_settings.blockedDomains || [])];
}

/**
 * Main entry point that initializes the script.
 */
async function initialize() {
  await loadModel();
  await replacePenisImages();

  // Debounced MutationObserver for dynamic content
  let mutationDebounce;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationDebounce);
    mutationDebounce = setTimeout(() => {
      replacePenisImages();
    }, 500);
  });
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
  ELEPHANT_CATEGORIES,
  CATEGORY_LABELS,
  loadNSFWThreshold,
  saveNSFWThreshold,
  getNSFWThreshold,
  setNSFWThreshold,
  loadSettings,
  saveSettings,
  updateSettings,
  getSettings,
  addCustomElephantImage,
  removeCustomElephantImage,
  getCustomElephantImages,
  exportSettings,
  importSettings,
  setAnimationsEnabled,
  areAnimationsEnabled,
  matchesDomain,
  isDomainAllowed,
  addAllowedDomain,
  removeAllowedDomain,
  getAllowedDomains,
  addBlockedDomain,
  removeBlockedDomain,
  getBlockedDomains,
  loadAnalytics,
  saveAnalytics,
  recordReplacement,
  getAnalytics,
  resetAnalytics,
  nsfwModel,
  undoLastReplacement,
};
