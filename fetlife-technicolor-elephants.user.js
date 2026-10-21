// ==UserScript==
// @name         FetLife Technicolor Elephants
// @namespace    http://tampermonkey.net/
// @version      0.4.2
// @description  Replaces images of penises on FetLife with pictures of tiny technicolor elephants using NSFW.js for detection. Includes configurable thresholds, image categories, analytics, keyboard shortcuts, custom elephant URLs, domain allow/block lists, undo, and animations.
// @author       You
// @match        https://fetlife.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@latest/dist/tf-backend-wasm.min.js
// @require      https://cdn.jsdelivr.net/npm/nsfwjs@latest/dist/nsfwjs.min.js
// ==/UserScript==

/* global tf, nsfwjs, GM_getValue, GM_setValue */
(function fteUserscript() {
  // Accessibility styles: visible focus rings and reduced-motion support.
  // Injected once so the in-page UI is keyboard-navigable and honours the
  // user's motion preferences.
  const a11yStyle = document.createElement('style');
  a11yStyle.id = 'fte-a11y-styles';
  a11yStyle.textContent = `
    #fte-settings-panel :focus-visible,
    #fte-toggle-btn:focus-visible {
      outline: 3px solid #1a73e8;
      outline-offset: 2px;
    }
    #fte-settings-panel button:focus-visible,
    #fte-settings-panel input:focus-visible,
    #fte-settings-panel select:focus-visible,
    #fte-settings-panel textarea:focus-visible {
      outline: 3px solid #1a73e8;
      outline-offset: 1px;
    }
    @media (prefers-reduced-motion: reduce) {
      #fte-settings-panel *, #fte-toggle-btn, #fte-toggle-badge {
        transition: none !important;
        animation: none !important;
      }
    }
  `;
  if (!document.getElementById('fte-a11y-styles')) {
    document.head.appendChild(a11yStyle);
  }

  // Storage abstraction for Tampermonkey GM_* APIs
  const storage = {
    get(key) {
      if (typeof GM_getValue === 'undefined') return undefined; // eslint-disable-line camelcase
      try {
        // eslint-disable-next-line camelcase
        return GM_getValue(key);
      } catch (e) {
        return undefined;
      }
    },
    set(key, value) {
      if (typeof GM_setValue === 'undefined') return; // eslint-disable-line camelcase
      try {
        // eslint-disable-next-line camelcase
        GM_setValue(key, value);
      } catch (e) {
        // ignore
      }
    },
  };

  // Categorized technicolor elephant image URLs
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

  // Flat array of all elephant images
  const ELEPHANT_IMAGES = Object.values(ELEPHANT_CATEGORIES).flat();

  // Category display names for UI
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

  // Analytics storage keys
  const ANALYTICS_KEY = 'fte_analytics';

  // Default settings
  const DEFAULT_SETTINGS = {
    nsfwThreshold: 0.7,
    selectedCategory: 'all',
    enabled: true,
    customElephantImages: [],
    enableAnimations: true,
    allowedDomains: [],
    blockedDomains: [],
    theme: 'auto',
    schedule: {
      enabled: false,
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5],
    },
  };

  let nsfwModel;
  let settings = { ...DEFAULT_SETTINGS };
  let analytics = {
    replacements: 0,
    byCategory: {},
    byConfidence: {},
    falsePositiveReports: 0,
    scheduleBypassCount: 0,
    timeOfDayStats: {},
  };

  // ----- Settings Management -----
  function loadSettings() {
    try {
      const saved = storage.get('fte_settings');
      if (saved) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('FetLife Technicolor Elephants: Could not load settings', e);
    }
  }

  function saveSettings() {
    try {
      storage.set('fte_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('FetLife Technicolor Elephants: Could not save settings', e);
    }
  }

  function getNSFWThreshold() {
    return settings.nsfwThreshold;
  }

  function setNSFWThreshold(value) {
    const num = parseFloat(value);
    if (!Number.isNaN(num) && num >= 0 && num <= 1) {
      settings.nsfwThreshold = num;
      saveSettings();
    }
  }

  function getSelectedCategory() {
    return settings.selectedCategory;
  }

  function setSelectedCategory(category) {
    if (category === 'all' || ELEPHANT_CATEGORIES[category]) {
      settings.selectedCategory = category;
      saveSettings();
    }
  }

  function isEnabled() {
    return settings.enabled;
  }

  function setEnabled(enabled) {
    settings.enabled = enabled;
    saveSettings();
  }

  // ----- Theme Management -----
  function getTheme() {
    return settings.theme || 'auto';
  }

  function setTheme(theme) {
    const valid = ['auto', 'light', 'dark'];
    if (valid.includes(theme)) {
      settings.theme = theme;
      saveSettings();
      injectThemeStyles();
    }
  }

  /**
   * Determines whether dark mode should be active based on the selected theme.
   * @returns {boolean} True if dark mode is active
   */
  function isDarkMode() {
    const theme = getTheme();
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // auto: respect prefers-color-scheme
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }
    return false;
  }

  /**
   * Injects theme-based CSS for the settings panel and overlays.
   */
  function injectThemeStyles() {
    const existing = document.getElementById('fte-theme-styles');
    if (existing) existing.remove();

    const dark = isDarkMode();
    const style = document.createElement('style');
    style.id = 'fte-theme-styles';
    style.textContent = `
      #fte-settings-panel {
        background: ${dark ? '#1e1e1e' : '#fff'} !important;
        color: ${dark ? '#e0e0e0' : '#333'} !important;
      }
      #fte-settings-panel h3,
      #fte-settings-panel strong,
      #fte-stats strong {
        color: ${dark ? '#ff8da5' : '#e84c8a'} !important;
      }
      #fte-settings-panel label,
      #fte-settings-panel span,
      #fte-settings-panel div {
        color: ${dark ? '#e0e0e0' : '#333'};
      }
      #fte-settings-panel input,
      #fte-settings-panel select,
      #fte-settings-panel textarea {
        background: ${dark ? '#2a2a2a' : '#fff'} !important;
        color: ${dark ? '#e0e0e0' : '#333'} !important;
        border: 1px solid ${dark ? '#555' : '#ddd'} !important;
      }
      #fte-settings-panel button {
        background: ${dark ? '#e84c8a' : '#e84c8a'} !important;
        color: white !important;
      }
      #fte-settings-panel button#fte-close-settings,
      #fte-settings-panel button#fte-reset-analytics,
      #fte-settings-panel button#fte-export-settings,
      #fte-settings-panel button#fte-import-settings-btn {
        color: ${dark ? '#e0e0e0' : '#333'} !important;
        background: ${dark ? '#2a2a2a' : '#f0f0f0'} !important;
        border: 1px solid ${dark ? '#555' : '#ddd'} !important;
      }
      #fte-stats {
        background: ${dark ? '#2a2a2a' : '#f9f9f9'} !important;
        color: ${dark ? '#e0e0e0' : '#333'} !important;
      }
      #fte-theme-help,
      #fte-domain-help,
      #fte-custom-help {
        color: ${dark ? '#aaa' : '#666'} !important;
      }
      .fte-false-positive-btn {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        background: rgba(0,0,0,0.6);
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s, background 0.2s;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .fte-false-positive-btn:hover {
        opacity: 1;
        background: rgba(232, 76, 138, 0.9);
      }
    `;
    document.head.appendChild(style);
  }

  // ----- False-Positive Whitelist -----
  const FALSE_POSITIVE_WHITELIST_KEY = 'fte_falsePositiveWhitelist';
  function loadFalsePositiveWhitelist() {
    const saved = storage.get(FALSE_POSITIVE_WHITELIST_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Could not load false-positive whitelist', e);
      }
    }
    return {};
  }
  function saveFalsePositiveWhitelist(map) {
    try {
      storage.set(FALSE_POSITIVE_WHITELIST_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Could not save false-positive whitelist', e);
    }
  }
  function isWhitelisted(src, now) {
    const whitelist = loadFalsePositiveWhitelist();
    const expiry = whitelist[src];
    if (!expiry) return false;
    const currentTime = now === undefined ? Date.now() : now;
    return currentTime < expiry;
  }
  function addToWhitelist(src, days) {
    const daysToKeep = days || 7;
    const expiry = Date.now() + daysToKeep * 24 * 60 * 60 * 1000;
    const whitelist = loadFalsePositiveWhitelist();
    whitelist[src] = expiry;
    saveFalsePositiveWhitelist(whitelist);
  }
  function cleanupWhitelist(now) {
    const currentTime = now === undefined ? Date.now() : now;
    const whitelist = loadFalsePositiveWhitelist();
    const clean = {};
    for (const [src, expiry] of Object.entries(whitelist)) {
      if (currentTime < expiry) {
        clean[src] = expiry;
      }
    }
    saveFalsePositiveWhitelist(clean);
  }

  // ----- Schedule Management -----
  const SCHEDULE_STORAGE_KEY = 'fte_scheduleSettings';
  function loadScheduleSettings() {
    const saved = storage.get(SCHEDULE_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Could not load schedule settings', e);
      }
    }
    return {
      enabled: false,
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5],
    };
  }
  function saveScheduleSettings(schedule) {
    try {
      storage.set(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
    } catch (e) {
      console.warn('Could not save schedule settings', e);
    }
  }
  function isWithinSchedule(now) {
    const currentTime = now === undefined ? Date.now() : now;
    const schedule = loadScheduleSettings();
    if (!schedule.enabled) return true;
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const time = hour * 60 + minute;
    const [startHour, startMin] = schedule.start.split(':').map(Number);
    const [endHour, endMin] = schedule.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    if (time < startTime || time >= endTime) return false;
    const dayIndex = currentTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const allowedDays = new Set(schedule.days);
    return allowedDays.has(dayIndex);
  }
  function getScheduleInfo(now) {
    const currentTime = now === undefined ? new Date() : now;
    const schedule = loadScheduleSettings();
    if (!schedule.enabled) return { within: true, nextStart: null, label: 'Active all day' };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIndex = currentTime.getDay();
    const isAllowed = schedule.days.includes(dayIndex);
    if (isAllowed) {
      const hour = currentTime.getHours();
      const minute = currentTime.getMinutes();
      const time = hour * 60 + minute;
      const [startHour, startMin] = schedule.start.split(':').map(Number);
      const [endHour, endMin] = schedule.end.split(':').map(Number);
      let nextStart = null;
      if (time < startHour * 60 + startMin) {
        nextStart = schedule.start;
      } else if (time >= endHour * 60 + endMin) {
        // next start is tomorrow
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowIndex = tomorrow.getDay();
        if (schedule.days.includes(tomorrowIndex)) {
          const nextDayName = dayNames[tomorrowIndex];
          nextStart = `${schedule.start} (${nextDayName})`;
        } else {
          // find next allowed day
          let i = 1;
          while (i < 7) {
            const checkIndex = (dayIndex + i) % 7;
            if (schedule.days.includes(checkIndex)) {
              nextStart = `${schedule.start} (${dayNames[checkIndex]})`;
              break;
            }
            i += 1;
          }
        }
      } else {
        nextStart = `until ${schedule.end}`;
      }
      return {
        within: true,
        nextStart,
        label: `Active ${schedule.start}-${schedule.end} ${dayNames[dayIndex]}`,
      };
    }
    // schedule disabled but would be active now
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const time = hour * 60 + minute;
    const [startHour, startMin] = schedule.start.split(':').map(Number);
    const [endHour, endMin] = schedule.end.split(':').map(Number);
    if (time >= startHour * 60 + startMin && time < endHour * 60 + endMin) {
      return {
        within: true,
        nextStart: null,
        label: `Active ${schedule.start}-${schedule.end} (schedule disabled)`,
      };
    }
    // find next day
    const nextStart = schedule.start;
    return {
      within: false,
      nextStart,
      label: 'Inactive',
    };
  }

  // ----- Analytics Helper -----
  function updateTimeOfDayStats(now) {
    const currentTime = now === undefined ? new Date() : now;
    const hour = currentTime.getHours();
    const key = `${hour}:00`;
    analytics.timeOfDayStats = analytics.timeOfDayStats || {};
    analytics.timeOfDayStats[key] = (analytics.timeOfDayStats[key] || 0) + 1;
    saveAnalytics();
  }

  // ----- Custom Elephant Images -----
  function addCustomElephantImage(url) {
    if (typeof url !== 'string' || !url.trim()) return false;
    const trimmed = url.trim();
    const pool = settings.customElephantImages || [];
    if (pool.includes(trimmed)) return false;
    pool.push(trimmed);
    settings.customElephantImages = pool;
    saveSettings();
    return true;
  }

  function removeCustomElephantImage(url) {
    const pool = settings.customElephantImages || [];
    const idx = pool.indexOf(url);
    if (idx === -1) return false;
    pool.splice(idx, 1);
    settings.customElephantImages = pool;
    saveSettings();
    return true;
  }

  function getCustomElephantImages() {
    return [...(settings.customElephantImages || [])];
  }

  // ----- Domain Allow/Block Lists -----
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

  function isDomainAllowed(hostname) {
    const host = hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
    if (!host) return true;
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

  function addAllowedDomain(domain) {
    if (typeof domain !== 'string' || !domain.trim()) return false;
    const trimmed = domain.trim();
    const list = settings.allowedDomains || [];
    if (list.includes(trimmed)) return false;
    list.push(trimmed);
    settings.allowedDomains = list;
    saveSettings();
    return true;
  }

  function removeAllowedDomain(domain) {
    const list = settings.allowedDomains || [];
    const idx = list.indexOf(domain);
    if (idx === -1) return false;
    list.splice(idx, 1);
    settings.allowedDomains = list;
    saveSettings();
    return true;
  }

  function getAllowedDomains() {
    return [...(settings.allowedDomains || [])];
  }

  function addBlockedDomain(domain) {
    if (typeof domain !== 'string' || !domain.trim()) return false;
    const trimmed = domain.trim();
    const list = settings.blockedDomains || [];
    if (list.includes(trimmed)) return false;
    list.push(trimmed);
    settings.blockedDomains = list;
    saveSettings();
    return true;
  }

  function removeBlockedDomain(domain) {
    const list = settings.blockedDomains || [];
    const idx = list.indexOf(domain);
    if (idx === -1) return false;
    list.splice(idx, 1);
    settings.blockedDomains = list;
    saveSettings();
    return true;
  }

  function getBlockedDomains() {
    return [...(settings.blockedDomains || [])];
  }

  // ----- Settings Export / Import -----
  function exportSettings() {
    return JSON.stringify(settings, null, 2);
  }

  function importSettings(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null) return false;
      settings = { ...DEFAULT_SETTINGS, ...parsed };
      saveSettings();
      return true;
    } catch (e) {
      console.warn('FetLife Technicolor Elephants: Could not import settings', e);
      return false;
    }
  }

  // ----- Analytics -----
  function loadAnalytics() {
    try {
      const saved = storage.get(ANALYTICS_KEY);
      if (saved) {
        analytics = JSON.parse(saved);
      }
    } catch (e) {
      analytics = { replacements: 0, byCategory: {}, byConfidence: {} };
    }
  }

  function saveAnalytics() {
    try {
      storage.set(ANALYTICS_KEY, JSON.stringify(analytics));
    } catch (e) {
      console.warn('FetLife Technicolor Elephants: Could not save analytics', e);
    }
  }

  function recordReplacement(category, confidence) {
    analytics.replacements += 1;
    if (category) {
      analytics.byCategory[category] = (analytics.byCategory[category] || 0) + 1;
    }
    if (confidence) {
      const bucket = Math.floor(confidence * 10) / 10;
      analytics.byConfidence[bucket] = (analytics.byConfidence[bucket] || 0) + 1;
    }
    saveAnalytics();
    updateToggleButtonStats();
  }

  function getAnalytics() {
    return { ...analytics };
  }

  function resetAnalytics() {
    analytics = {
      replacements: 0,
      byCategory: {},
      byConfidence: {},
      falsePositiveReports: 0,
      scheduleBypassCount: 0,
      timeOfDayStats: {},
    };
    saveAnalytics();
    updateToggleButtonStats();
  }

  // ----- Elephant Selection -----
  function getRandomElephantImage(category) {
    const pool = getCustomElephantImages();
    if (category && category !== 'all' && ELEPHANT_CATEGORIES[category]) {
      const categoryArray = ELEPHANT_CATEGORIES[category];
      if (pool.length > 0 && Math.random() < 0.5) {
        return pool[Math.floor(Math.random() * pool.length)];
      }
      return categoryArray[Math.floor(Math.random() * categoryArray.length)];
    }
    const allImages = ELEPHANT_IMAGES.concat(pool);
    return allImages[Math.floor(Math.random() * allImages.length)];
  }

  // ----- Settings UI -----
  function renderCustomList(urls) {
    if (!urls || urls.length === 0) {
      return '<span style="color: #888; font-style: italic;">No custom URLs added</span>';
    }
    return urls.map((url, i) => `
      <div role="listitem" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #eee;">
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; font-size: 11px;">${url}</span>
        <button type="button" data-idx="${i}" aria-label="Remove ${url}" style="background: none; border: none; color: #e84c8a; cursor: pointer; font-size: 14px; padding: 2px 6px;">Remove</button>
      </div>
    `).join('');
  }

  function renderDomainList(domains) {
    if (!domains || domains.length === 0) {
      return '<span style="color: #888; font-style: italic;">None configured</span>';
    }
    return domains.map((domain, i) => `
      <div role="listitem" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #eee;">
        <span style="font-family: monospace; font-size: 11px; color: #333;">${domain}</span>
        <button type="button" data-idx="${i}" aria-label="Remove ${domain}" style="background: none; border: none; color: #e84c8a; cursor: pointer; font-size: 14px; padding: 2px 6px;">✕</button>
      </div>
    `).join('');
  }

  // Focusable elements inside the settings panel, used for the focus trap.
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Closes the settings panel, restoring focus to the toggle button.
   */
  function closeSettingsPanel() {
    const panel = document.getElementById('fte-settings-panel');
    if (!panel) return;
    panel.remove();
    const btn = document.getElementById('fte-toggle-btn');
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  }

  /**
   * Closes the settings panel when a click lands outside of it.
   * Registered once at initialization so opening/closing the panel does not
   * accumulate document listeners.
   * @param {MouseEvent} e - The click event
   */
  function handleOutsideClick(e) {
    const panel = document.getElementById('fte-settings-panel');
    if (!panel) return;
    if (!panel.contains(e.target) && e.target.id !== 'fte-toggle-btn') {
      closeSettingsPanel();
    }
  }

  /**
   * Determines whether an element is visible (and therefore focusable).
   * @param {HTMLElement} el - The element to check
   * @returns {boolean} True if the element is visible
   */
  function isVisibleElement(el) {
    if (el.hidden) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const view = el.ownerDocument.defaultView;
    if (view && typeof view.getComputedStyle === 'function') {
      const style = view.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }

  /**
   * Keeps keyboard focus within the settings panel while it is open.
   * @param {KeyboardEvent} e - The keydown event
   */
  function trapFocus(e) {
    const panel = document.getElementById('fte-settings-panel');
    if (!panel) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSettingsPanel();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusables = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter((el) => isVisibleElement(el));
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function createSettingsPanel() {
    if (document.getElementById('fte-settings-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'fte-settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'fte-panel-title');
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      background: #fff;
      border: 2px solid #e84c8a;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 300px;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const analyticsData = getAnalytics();
    const totalReplacements = analyticsData.replacements || 0;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 id="fte-panel-title" style="margin: 0; color: #e84c8a;">🐘 FetLife Technicolor Elephants</h3>
        <button id="fte-close-settings" type="button" aria-label="Close settings" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
      </div>

      <div id="fte-stats" role="status" aria-live="polite" style="margin-bottom: 16px; padding: 12px; background: #f9f9f9; border-radius: 8px;">
        <strong>Stats:</strong> ${totalReplacements} images replaced
      </div>

      <div style="margin-bottom: 12px;">
        <label for="fte-enabled" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="fte-enabled" ${settings.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
          <span>Enable elephant replacements</span>
        </label>
      </div>

      <div style="margin-bottom: 16px;">
        <label for="fte-threshold" style="display: block; margin-bottom: 6px;"><strong>NSFW Threshold: <span id="fte-threshold-display" aria-hidden="true">${settings.nsfwThreshold}</span></strong></label>
        <input type="range" id="fte-threshold" min="0.1" max="0.95" step="0.05" value="${settings.nsfwThreshold}" aria-describedby="fte-threshold-help" style="width: 100%;">
        <div id="fte-threshold-help" style="font-size: 12px; color: #666; margin-top: 4px;">Lower = more replacements (more false positives). Higher = fewer replacements (stricter).</div>
      </div>

      <div style="margin-bottom: 16px;">
        <label for="fte-category" style="display: block; margin-bottom: 6px;"><strong>Elephant Style:</strong></label>
        <select id="fte-category" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="all" ${settings.selectedCategory === 'all' ? 'selected' : ''}>All Styles (Random)</option>
          ${Object.entries(CATEGORY_LABELS).map(([key, label]) => `
            <option value="${key}" ${settings.selectedCategory === key ? 'selected' : ''}>${label}</option>
          `).join('')}
        </select>
      </div>

      <div style="margin-bottom: 16px;">
        <label for="fte-custom-url" style="display: block; margin-bottom: 6px;"><strong>Custom Elephant URLs:</strong></label>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <input type="url" id="fte-custom-url" placeholder="https://i.imgur.com/xxx.jpg" aria-describedby="fte-custom-help" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
          <button id="fte-add-custom" type="button" style="padding: 8px 12px; background: #e84c8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Add</button>
        </div>
        <div id="fte-custom-list" role="list" aria-label="Custom elephant URLs" style="font-size: 12px; color: #333;">
          ${renderCustomList(getCustomElephantImages())}
        </div>
        <div id="fte-custom-help" style="font-size: 11px; color: #666; margin-top: 4px;">Direct image URLs only.</div>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button id="fte-test-replace" type="button" style="flex: 1; padding: 8px; background: #e84c8a; color: white; border: none; border-radius: 4px; cursor: pointer;">Test Replace</button>
        <button id="fte-reset-analytics" type="button" style="flex: 1; padding: 8px; background: #f0f0f0; color: #333; border: none; border-radius: 4px; cursor: pointer;">Reset Stats</button>
      </div>

      <div style="margin-bottom: 12px;">
        <button id="fte-export-settings" type="button" style="width: 100%; padding: 8px; background: #f0f0f0; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Export Settings (JSON)</button>
      </div>
      <div style="margin-bottom: 12px;">
        <label for="fte-import-settings" class="fte-visually-hidden" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;">Settings JSON to import</label>
        <textarea id="fte-import-settings" placeholder="Paste JSON settings to import..." style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace;"></textarea>
      </div>
      <div style="margin-bottom: 16px;">
        <button id="fte-import-settings-btn" type="button" style="width: 100%; padding: 8px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Import Settings</button>
        <div id="fte-import-msg" role="status" aria-live="polite" style="font-size: 11px; color: #666; margin-top: 4px; text-align: center;"></div>
      </div>

      <div style="margin-bottom: 12px;">
        <button id="fte-undo-last" type="button" style="width: 100%; padding: 8px; background: #9b59b6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Undo Last Replacement</button>
      </div>

      <div style="margin-bottom: 12px;">
        <label for="fte-animations" style="display: block; margin-bottom: 6px;"><strong>Enable Animations:</strong></label>
        <select id="fte-animations" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="true" ${settings.enableAnimations !== false ? 'selected' : ''}>Enabled</option>
          <option value="false" ${settings.enableAnimations === false ? 'selected' : ''}>Reduced Motion</option>
        </select>
      </div>

      <div style="margin-bottom: 12px;">
        <label for="fte-theme" style="display: block; margin-bottom: 6px;"><strong>Theme:</strong></label>
        <select id="fte-theme" aria-describedby="fte-theme-help" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="auto" ${getTheme() === 'auto' ? 'selected' : ''}>Auto (match system)</option>
          <option value="light" ${getTheme() === 'light' ? 'selected' : ''}>Light</option>
          <option value="dark" ${getTheme() === 'dark' ? 'selected' : ''}>Dark</option>
        </select>
        <div id="fte-theme-help" style="font-size: 11px; color: #666; margin-top: 4px;">Auto follows your operating system's light/dark setting.</div>
      </div>

      <div style="margin-bottom: 16px;">
        <label for="fte-allowed-domain" style="display: block; margin-bottom: 6px;"><strong>Allowed Domains (blank = all):</strong></label>
        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <input type="text" id="fte-allowed-domain" placeholder="example.com" aria-describedby="fte-domain-help" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
          <button id="fte-add-allowed" type="button" style="padding: 6px 10px; background: #e84c8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Add</button>
        </div>
        <div id="fte-allowed-list" role="list" aria-label="Allowed domains" style="font-size: 11px; color: #333;">
          ${renderDomainList(getAllowedDomains())}
        </div>
        <div id="fte-domain-help" style="font-size: 11px; color: #666; margin-top: 4px;">Supports: example.com, *.example.com</div>
      </div>

      <div style="margin-bottom: 16px;">
        <label for="fte-blocked-domain" style="display: block; margin-bottom: 6px;"><strong>Blocked Domains:</strong></label>
        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <input type="text" id="fte-blocked-domain" placeholder="blocked.com" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
          <button id="fte-add-blocked" type="button" style="padding: 6px 10px; background: #e84c8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Add</button>
        </div>
        <div id="fte-blocked-list" role="list" aria-label="Blocked domains" style="font-size: 11px; color: #333;">
          ${renderDomainList(getBlockedDomains())}
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <label for="fte-schedule-enabled" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="fte-schedule-enabled" ${loadScheduleSettings().enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
          <span>Schedule: only replace during set hours</span>
        </label>
        <div id="fte-schedule-controls" style="margin-top: 10px; ${loadScheduleSettings().enabled ? '' : 'display: none;'}">
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <label for="fte-schedule-start" style="font-size: 11px; color: #666;">Start</label>
              <input type="time" id="fte-schedule-start" value="${loadScheduleSettings().start}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="flex: 1;">
              <label for="fte-schedule-end" style="font-size: 11px; color: #666;">End</label>
              <input type="time" id="fte-schedule-end" value="${loadScheduleSettings().end}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
          </div>
<fieldset style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 12px;">
            <legend style="font-size: 11px; color: #666; padding: 0 4px;">Days of week</legend>
            ${
  [
    ['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6],
  ].map(([name, idx]) => `
              <label style="display: inline-block; margin: 2px 4px; cursor: pointer;" for="fte-schedule-day-${idx}">
                <input type="checkbox" class="fte-schedule-day" id="fte-schedule-day-${idx}" value="${idx}" ${loadScheduleSettings().days.includes(idx) ? 'checked' : ''} style="margin-right: 2px;">
                <span>${name}</span>
              </label>`).join('')
  }
          </fieldset>
          <div id="fte-schedule-status" style="font-size: 11px; color: #666; margin-top: 6px;">
            ${getScheduleInfo().label}
          </div>
        </div>
      </div>

      <div style="font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px;">
        <strong>Keyboard Shortcuts:</strong><br>
        <kbd style="background:#f0f0f0;padding:2px 6px;border-radius:3px;">Ctrl+Shift+E</kbd> Toggle enabled<br>
        <kbd style="background:#f0f0f0;padding:2px 6px;border-radius:3px;">Ctrl+Shift+R</kbd> Cycle style<br>
        <kbd style="background:#f0f0f0;padding:2px 6px;border-radius:3px;">Ctrl+Shift+T</kbd> Open settings<br>
        <kbd style="background:#f0f0f0;padding:2px 6px;border-radius:3px;">Ctrl+Shift+U</kbd> Undo last replacement
      </div>
    `;

    document.body.appendChild(panel);

    // Move focus into the panel and keep it there while open
    const toggleBtn = document.getElementById('fte-toggle-btn');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    panel.addEventListener('keydown', trapFocus);
    const closeBtn = document.getElementById('fte-close-settings');
    if (closeBtn) closeBtn.focus();

    // Event listeners
    document.getElementById('fte-close-settings').addEventListener('click', () => closeSettingsPanel());
    document.getElementById('fte-enabled').addEventListener('change', (e) => {
      setEnabled(e.target.checked);
    });
    document.getElementById('fte-threshold').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('fte-threshold-display').textContent = val;
    });
    document.getElementById('fte-threshold').addEventListener('change', (e) => {
      setNSFWThreshold(parseFloat(e.target.value));
    });
    document.getElementById('fte-category').addEventListener('change', (e) => {
      setSelectedCategory(e.target.value);
    });
    document.getElementById('fte-test-replace').addEventListener('click', () => {
      const category = getSelectedCategory();
      const img = getRandomElephantImage(category);
      const testImg = new Image();
      testImg.src = img;
      testImg.style.cssText = 'max-width: 200px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
      const existing = document.getElementById('fte-test-preview');
      if (existing) existing.remove();
      testImg.id = 'fte-test-preview';
      panel.appendChild(testImg);
    });
    document.getElementById('fte-reset-analytics').addEventListener('click', () => {
      resetAnalytics();
      panel.querySelector('#fte-stats').innerHTML = '<strong>Stats:</strong> 0 images replaced';
    });
    document.getElementById('fte-add-custom').addEventListener('click', () => {
      const input = document.getElementById('fte-custom-url');
      const url = input.value.trim();
      if (!url) return;
      if (addCustomElephantImage(url)) {
        input.value = '';
      }
      document.getElementById('fte-custom-list').innerHTML = renderCustomList(getCustomElephantImages());
    });
    document.getElementById('fte-custom-list').addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-idx');
      if (idx === null) return;
      const urls = getCustomElephantImages();
      removeCustomElephantImage(urls[Number(idx)]);
      document.getElementById('fte-custom-list').innerHTML = renderCustomList(getCustomElephantImages());
    });
    document.getElementById('fte-add-allowed').addEventListener('click', () => {
      const input = document.getElementById('fte-allowed-domain');
      const domain = input.value.trim();
      if (!domain) return;
      if (addAllowedDomain(domain)) {
        input.value = '';
      }
      document.getElementById('fte-allowed-list').innerHTML = renderDomainList(getAllowedDomains());
    });
    document.getElementById('fte-allowed-list').addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-idx');
      if (idx === null) return;
      const domains = getAllowedDomains();
      removeAllowedDomain(domains[Number(idx)]);
      document.getElementById('fte-allowed-list').innerHTML = renderDomainList(getAllowedDomains());
    });
    document.getElementById('fte-add-blocked').addEventListener('click', () => {
      const input = document.getElementById('fte-blocked-domain');
      const domain = input.value.trim();
      if (!domain) return;
      if (addBlockedDomain(domain)) {
        input.value = '';
      }
      document.getElementById('fte-blocked-list').innerHTML = renderDomainList(getBlockedDomains());
    });
    document.getElementById('fte-blocked-list').addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-idx');
      if (idx === null) return;
      const domains = getBlockedDomains();
      removeBlockedDomain(domains[Number(idx)]);
      document.getElementById('fte-blocked-list').innerHTML = renderDomainList(getBlockedDomains());
    });
    document.getElementById('fte-export-settings').addEventListener('click', () => {
      const data = exportSettings();
      const msg = document.getElementById('fte-import-msg');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(() => {
          msg.textContent = 'Settings copied to clipboard';
        }).catch(() => {
          document.getElementById('fte-import-settings').value = data;
          msg.textContent = 'Settings placed in the import box below';
        });
      } else {
        document.getElementById('fte-import-settings').value = data;
        msg.textContent = 'Settings placed in the import box below';
      }
    });
    document.getElementById('fte-import-settings-btn').addEventListener('click', () => {
      const msg = document.getElementById('fte-import-msg');
      const raw = document.getElementById('fte-import-settings').value.trim();
      if (!raw) {
        msg.textContent = 'Nothing to import';
        return;
      }
      if (importSettings(raw)) {
        msg.textContent = 'Settings imported — reopening panel';
        panel.remove();
        createSettingsPanel();
      } else {
        msg.textContent = 'Import failed: invalid JSON';
      }
    });
    document.getElementById('fte-undo-last').addEventListener('click', () => {
      if (undoLastReplacement()) {
        // Optionally reopen panel to reflect the change, or just log
        console.log('FetLife Technicolor Elephants: Undo completed');
      }
    });
    document.getElementById('fte-animations').addEventListener('change', (e) => {
      settings.enableAnimations = e.target.value === 'true';
      saveSettings();
    });
    document.getElementById('fte-theme').addEventListener('change', (e) => {
      setTheme(e.target.value);
    });

    // Schedule controls
    const scheduleEnabled = document.getElementById('fte-schedule-enabled');
    if (scheduleEnabled) {
      scheduleEnabled.addEventListener('change', (e) => {
        const schedule = loadScheduleSettings();
        schedule.enabled = e.target.checked;
        saveScheduleSettings(schedule);
        // Show/hide controls
        const controls = document.getElementById('fte-schedule-controls');
        if (controls) controls.style.display = e.target.checked ? 'block' : 'none';
        // Refresh panel to update status
        setTimeout(createSettingsPanel, 0);
      });
    }
    const scheduleStart = document.getElementById('fte-schedule-start');
    if (scheduleStart) {
      scheduleStart.addEventListener('change', (e) => {
        const schedule = loadScheduleSettings();
        schedule.start = e.target.value;
        saveScheduleSettings(schedule);
      });
    }
    const scheduleEnd = document.getElementById('fte-schedule-end');
    if (scheduleEnd) {
      scheduleEnd.addEventListener('change', (e) => {
        const schedule = loadScheduleSettings();
        schedule.end = e.target.value;
        saveScheduleSettings(schedule);
      });
    }
    document.querySelectorAll('.fte-schedule-day').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const schedule = loadScheduleSettings();
        const checked = Array.from(document.querySelectorAll('.fte-schedule-day:checked')).map((c) => Number(c.value));
        schedule.days = checked.length ? checked : [1, 2, 3, 4, 5];
        saveScheduleSettings(schedule);
      });
    });

    // Close on outside click (handler registered once at initialization)
  }

  // Toggle button in corner
  function createToggleButton() {
    if (document.getElementById('fte-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'fte-toggle-btn';
    btn.type = 'button';
    btn.title = 'FetLife Technicolor Elephants - Click for settings (Ctrl+Shift+T)';
    btn.setAttribute('aria-label', 'FetLife Technicolor Elephants settings');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'fte-settings-panel');
    // Badge span for stats HUD
    const badge = document.createElement('span');
    badge.id = 'fte-toggle-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = `
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ff4757;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      opacity: 0;
      transition: opacity 0.2s;
    `;
    btn.appendChild(badge);

    const icon = document.createElement('span');
    icon.textContent = '🐘';
    icon.setAttribute('aria-hidden', 'true');
    btn.appendChild(icon);

    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #e84c8a;
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(232, 76, 138, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 20px rgba(232, 76, 138, 0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 15px rgba(232, 76, 138, 0.4)';
    });
    btn.addEventListener('click', () => {
      const existing = document.getElementById('fte-settings-panel');
      if (existing) {
        closeSettingsPanel();
      } else {
        createSettingsPanel();
      }
    });
    document.body.appendChild(btn);

    // Initial badge update
    updateToggleButtonStats();
  }

  function updateToggleButtonStats() {
    const btn = document.getElementById('fte-toggle-btn');
    const badge = document.getElementById('fte-toggle-badge');
    if (!btn || !badge) return;

    const count = analytics.replacements || 0;
    const falsePositives = analytics.falsePositiveReports || 0;
    const within = isWithinSchedule(new Date());
    const badgeParts = [count > 0 ? String(count) : ''];
    if (!within) badgeParts.push('SCHEDULED-OFF');
    if (falsePositives > 0) badgeParts.push(`FP:${falsePositives}`);
    badge.textContent = badgeParts.filter(Boolean).join(' ');
    badge.style.opacity = badgeParts.length > 0 ? '1' : '0';
    // Expose the count to assistive tech (the badge itself is aria-hidden)
    const labelParts = ['FetLife Technicolor Elephants settings'];
    if (count > 0) {
      labelParts.push(`${count} image${count === 1 ? '' : 's'} replaced`);
    }
    if (falsePositives > 0) {
      labelParts.push(`${falsePositives} false-positive report${falsePositives === 1 ? '' : 's'}`);
    }
    btn.setAttribute('aria-label', labelParts.join(', '));
  }

  // ----- Keyboard Shortcuts -----
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'e': {
            e.preventDefault();
            setEnabled(!settings.enabled);
            console.log('FetLife Technicolor Elephants:', settings.enabled ? 'Enabled' : 'Disabled');
            break;
          }
          case 'r': {
            e.preventDefault();
            const categories = Object.keys(ELEPHANT_CATEGORIES);
            const currentIdx = categories.indexOf(settings.selectedCategory);
            const nextIdx = (currentIdx + 1) % (categories.length + 1); // +1 for 'all'
            const nextCategory = nextIdx === categories.length ? 'all' : categories[nextIdx];
            setSelectedCategory(nextCategory);
            console.log('FetLife Technicolor Elephants: Style changed to', CATEGORY_LABELS[nextCategory] || 'All');
            break;
          }
          case 't': {
            e.preventDefault();
            const panel = document.getElementById('fte-settings-panel');
            if (panel) closeSettingsPanel();
            else createSettingsPanel();
            break;
          }
          case 'u': {
            e.preventDefault();
            undoLastReplacement();
            break;
          }
          default:
            break;
        }
      }
    });
  }

  // ----- Core Functions -----
  function isNSFW(predictions) {
    const threshold = getNSFWThreshold();
    return predictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > threshold);
  }

  // Undo history stack for image replacements
  const _undoHistory = [];
  const MAX_UNDO_HISTORY = 50;

  // ----- Animations -----
  function areAnimationsEnabled() {
    if (typeof window !== 'undefined') {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
    }
    return settings.enableAnimations !== false;
  }

  function replaceWithElephant(img) {
    const category = getSelectedCategory();
    const randomElephant = getRandomElephantImage(category);
    // Record original src before replacing for undo support
    _undoHistory.push({ img, originalSrc: img.src });
    if (_undoHistory.length > MAX_UNDO_HISTORY) {
      _undoHistory.shift();
    }

    // Ensure container is positioned for overlay
    const container = img.parentElement;
    if (container && container.style.position === '') {
      container.style.position = 'relative';
    }

    if (areAnimationsEnabled()) {
      // Fade out → swap src → fade in
      const transitionStyle = img.style.transition;
      img.style.transition = 'opacity 0.3s ease';
      img.style.opacity = '0';
      img.addEventListener('transitionend', () => {
        img.src = randomElephant;
        img.srcset = '';
        img.style.opacity = '1';
        img.style.transition = transitionStyle;
        addFalsePositiveButton(img);
        console.log('FetLife Technicolor Elephants: Replaced NSFW image with technicolor elephant.');
      }, { once: true });
    } else {
      img.src = randomElephant;
      img.srcset = '';
      addFalsePositiveButton(img);
      console.log('FetLife Technicolor Elephants: Replaced NSFW image with technicolor elephant.');
    }
  }

  function addFalsePositiveButton(img) {
    // Remove any existing button
    const existing = document.getElementById(`fte-fp-btn-${img.dataset.id}`);
    if (existing) existing.remove();

    const fpBtn = document.createElement('button');
    fpBtn.id = `fte-fp-btn-${img.dataset.id}`;
    fpBtn.className = 'fte-false-positive-btn';
    fpBtn.setAttribute('aria-label', 'Report this was not NSFW');
    fpBtn.title = 'Report this was not NSFW';
    fpBtn.textContent = '✗';
    fpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addToWhitelist(img.src, 7);
      analytics.falsePositiveReports = (analytics.falsePositiveReports || 0) + 1;
      saveAnalytics();
      // Restore original image immediately
      if (img.dataset.originalSrc && img.src !== img.dataset.originalSrc) {
        img.src = img.dataset.originalSrc;
        img.srcset = '';
      }
      fpBtn.remove();
      console.log('FetLife Technicolor Elephants: User reported false positive. Image whitelisted.');
    });
    img.insertAdjacentElement('afterend', fpBtn);
  }

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

  async function checkAndReplaceImage(img) {
    if (!isEnabled()) return;
    if (img.dataset.nsfwChecked || img.width < 50 || img.height < 50) {
      return;
    }
    // Skip if whitelisted
    if (isWhitelisted(img.src)) {
      img.dataset.nsfwChecked = 'true';
      return;
    }
    img.dataset.nsfwChecked = 'true';

    // If the model hasn't loaded yet (or failed), don't attempt classification
    if (!nsfwModel) {
      return;
    }

    try {
      const predictions = await nsfwModel.classify(img);
      const shouldReplace = isNSFW(predictions);

      if (shouldReplace) {
        // Find which category triggered the replacement
        const maxPred = predictions.reduce((max, p) => (p.probability > max.probability ? p : max), { className: '', probability: 0 });
        replaceWithElephant(img);
        recordReplacement(getSelectedCategory(), maxPred.probability);
      }
    } catch (error) {
      console.error('FetLife Technicolor Elephants: Error classifying image:', error);
    }
  }

  // ----- Performance: Viewport-aware + debounced replacement -----
  let _replaceProcessing = false;
  const _replaceCooldownMs = 30000;
  const _replaceLastReplaced = new WeakMap();

  async function replacePenisImages() {
    if (!isEnabled()) return;
    if (_replaceProcessing || !nsfwModel) {
      // Model not loaded yet - retry later
      setTimeout(replacePenisImages, 5000);
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
   * Attempts to load the NSFW model with a specific TensorFlow backend.
   * @param {string} backend - The backend name ('gl', 'cpu', 'wasm')
   * @returns {Promise<boolean>} True if the model loaded successfully
   */
  const MODEL_URLS = [
    'https://raw.githubusercontent.com/cookeville-munch/fetlife-technicolor-elephants/master/model/model.json', // self-hosted model
    'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/model.json', // upstream fallback
  ];

  async function tryLoadModelWithBackend(backend, modelUrl) {
    try {
      console.log(`FetLife Technicolor Elephants: Trying backend "${backend}" with model ${modelUrl}...`);
      tf.setBackend(backend);
      await tf.ready();

      nsfwModel = await nsfwjs.load(modelUrl);
      console.log(`FetLife Technicolor Elephants: NSFW.js model loaded successfully with ${backend} backend from ${modelUrl}`);
      await replacePenisImages();
      return true;
    } catch (error) {
      console.warn(`FetLife Technicolor Elephants: Backend "${backend}" with model ${modelUrl} failed:`, error.message);
      // Clean up backend state before trying the next one
      try {
        tf.removeBackend(backend);
      } catch (cleanupError) {
        console.debug('FetLife Technicolor Elephants: Backend cleanup skipped:', cleanupError.message);
      }
      return false;
    }
  }

  async function loadModel() {
    if (typeof tf === 'undefined' || typeof nsfwjs === 'undefined') {
      console.error('FetLife Technicolor Elephants: Required libraries (tf/nsfwjs) are not loaded. Check @require URLs or network connectivity.');
      return false;
    }
    console.log('FetLife Technicolor Elephants: Loading NSFW.js model...');

    // Try WebGL first (most reliable in userscript/browser contexts).
    // WASM requires the .wasm file to be served correctly, which often fails
    // in userscript sandboxes where the CDN path is not resolvable.
    // Backends MUST be tried sequentially: tf.setBackend() mutates global state.
    const backends = ['gl', 'cpu']; // WebGL, then pure CPU
    for (const backend of backends) {
      for (const modelUrl of MODEL_URLS) {
        // eslint-disable-next-line no-await-in-loop
        const loaded = await tryLoadModelWithBackend(backend, modelUrl);
        if (loaded) return true;
      }
    }

    console.error('FetLife Technicolor Elephants: All model load attempts failed.');
    return false;
  }

  // ----- Initialization -----
  async function initialize() {
    // Check domain allow/block list first
    if (!isDomainAllowed()) {
      console.log('FetLife Technicolor Elephants: Domain not allowed, script disabled on this site.');
      return;
    }

    loadSettings();
    loadAnalytics();

    // Check schedule
    if (!isWithinSchedule(new Date())) {
      analytics.scheduleBypassCount = (analytics.scheduleBypassCount || 0) + 1;
      saveAnalytics();
      console.log('FetLife Technicolor Elephants: Not within scheduled activation window.');
      createToggleButton();
      setupKeyboardShortcuts();
      // Registered once so opening/closing the panel never stacks listeners
      document.addEventListener('click', handleOutsideClick);
      injectThemeStyles();
      updateToggleButtonStats();
      return;
    }

    createToggleButton();
    setupKeyboardShortcuts();
    // Registered once so opening/closing the panel never stacks listeners
    document.addEventListener('click', handleOutsideClick);
    injectThemeStyles();
    cleanupWhitelist();

    // Debounced MutationObserver for dynamic content
    // Set up IMMEDIATELY so dynamic images are always watched, regardless of model load status
    let mutationDebounce;
    const observer = new MutationObserver(() => {
      clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(() => {
        replacePenisImages();
      }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    await loadModel();

    // Once the model loads, immediately process any images that were already seen
    await replacePenisImages();
  }

  initialize().catch((err) => {
    console.error('FetLife Technicolor Elephants: Initialization failed:', err);
  });
}());
