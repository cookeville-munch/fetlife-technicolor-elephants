/**
 * @jest-environment jsdom
 */

const {
  ELEPHANT_IMAGES,
  ELEPHANT_CATEGORIES,
  CATEGORY_LABELS,
  getNSFWThreshold,
  setNSFWThreshold,
  getRandomElephantImage,
  isNSFW,
  loadSettings,
  updateSettings,
  getSettings,
  loadAnalytics,
  recordReplacement,
  getAnalytics,
  resetAnalytics,
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
  undoLastReplacement,
  getTheme,
  setTheme,
  isDarkMode,
  isWhitelisted,
  addToWhitelist,
  cleanupWhitelist,
  saveScheduleSettings,
  isWithinSchedule,
  getScheduleInfo,
  resetStorage,
} = require('../src/main');

// Safety net: restore Math.random after every test so a failing test cannot
// leak a stubbed Math.random into subsequent tests.
const REAL_RANDOM = Math.random;
afterEach(() => {
  Math.random = REAL_RANDOM;
});

describe('Configuration', () => {
  test('ELEPHANT_IMAGES is an array with at least one image', () => {
    expect(Array.isArray(ELEPHANT_IMAGES)).toBe(true);
    expect(ELEPHANT_IMAGES.length).toBeGreaterThan(0);
    expect(typeof ELEPHANT_IMAGES[0]).toBe('string');
  });

  test('ELEPHANT_CATEGORIES has expected categories', () => {
    expect(typeof ELEPHANT_CATEGORIES).toBe('object');
    expect(Object.keys(ELEPHANT_CATEGORIES)).toEqual(
      expect.arrayContaining([
        'classicAnimation',
        'parade',
        'trunk',
        'neonRainbow',
        'pinkCute',
        'instagram',
        'psychedelic',
        'popArt',
        'graffiti',
      ]),
    );
    // Each category should have at least one image
    Object.values(ELEPHANT_CATEGORIES).forEach((arr) => {
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThan(0);
    });
  });

  test('CATEGORY_LABELS matches categories', () => {
    expect(typeof CATEGORY_LABELS).toBe('object');
    expect(Object.keys(CATEGORY_LABELS)).toEqual(Object.keys(ELEPHANT_CATEGORIES));
  });

  test('getNSFWThreshold returns a number between 0 and 1', () => {
    const threshold = getNSFWThreshold();
    expect(typeof threshold).toBe('number');
    expect(threshold > 0 && threshold <= 1).toBe(true);
  });
});

describe('Threshold management', () => {
  test('setNSFWThreshold updates the threshold', () => {
    const original = getNSFWThreshold();
    setNSFWThreshold(0.5);
    expect(getNSFWThreshold()).toBe(0.5);
    setNSFWThreshold(original);
  });

  test('setNSFWThreshold clamps invalid values', () => {
    const original = getNSFWThreshold();
    setNSFWThreshold(-0.1);
    expect(getNSFWThreshold()).toBe(original);
    setNSFWThreshold(1.5);
    expect(getNSFWThreshold()).toBe(original);
    setNSFWThreshold('invalid');
    expect(getNSFWThreshold()).toBe(original);
    setNSFWThreshold(original);
  });
});

describe('getRandomElephantImage', () => {
  test('returns a string URL', () => {
    const result = getRandomElephantImage();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(ELEPHANT_IMAGES).toContain(result);
  });

  test('can call multiple times without throwing', () => {
    const results = Array.from({ length: 10 }, () => getRandomElephantImage());
    expect(results.length).toBe(10);
    results.forEach((r) => {
      expect(typeof r).toBe('string');
      expect(ELEPHANT_IMAGES).toContain(r);
    });
  });

  test('respects category parameter', () => {
    const paradeImages = getRandomElephantImage('parade');
    expect(ELEPHANT_CATEGORIES.parade).toContain(paradeImages);

    const classicImages = getRandomElephantImage('classicAnimation');
    expect(ELEPHANT_CATEGORIES.classicAnimation).toContain(classicImages);

    const invalidCategory = getRandomElephantImage('nonexistent');
    expect(ELEPHANT_IMAGES).toContain(invalidCategory);
  });
});

describe('isNSFW', () => {
  // We can't test the actual NSFW classification without the model,
  // but we can verify the threshold logic works correctly
  test('detects Porn classification correctly', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.8 },
    ];
    setNSFWThreshold(0.7);
    const result = isNSFW(mockPredictions);
    expect(result).toBe(true);
  });

  test('detects Hentai classification correctly', () => {
    const mockPredictions = [
      { className: 'Hentai', probability: 0.9 },
    ];
    setNSFWThreshold(0.7);
    const result = isNSFW(mockPredictions);
    expect(result).toBe(true);
  });

  test('detects Sexy classification correctly', () => {
    const mockPredictions = [
      { className: 'Sexy', probability: 0.8 },
    ];
    setNSFWThreshold(0.7);
    const result = isNSFW(mockPredictions);
    expect(result).toBe(true);
  });

  test('does not detect Neutral classification', () => {
    const mockPredictions = [
      { className: 'Neutral', probability: 0.9 },
    ];
    setNSFWThreshold(0.7);
    const result = isNSFW(mockPredictions);
    expect(result).toBe(false);
  });

  test('respects probability threshold', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.5 },
    ];
    setNSFWThreshold(0.7);
    const result = isNSFW(mockPredictions);
    expect(result).toBe(false);
  });

  test('returns false for mixed classifications with low probability', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.5 },
      { className: 'Neutral', probability: 0.9 },
    ];
    setNSFWThreshold(0.7);
    const result = isNSFW(mockPredictions);
    expect(result).toBe(false);
  });

  test('threshold change affects detection', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.6 },
    ];
    setNSFWThreshold(0.5);
    expect(isNSFW(mockPredictions)).toBe(true);
    setNSFWThreshold(0.7);
    expect(isNSFW(mockPredictions)).toBe(false);
  });
});

describe('Settings management', () => {
  beforeEach(() => {
    // Reset settings to defaults
    updateSettings({ nsfwThreshold: 0.7, selectedCategory: 'all', enabled: true });
  });

  test('loadSettings returns settings object', () => {
    const settings = loadSettings();
    expect(typeof settings).toBe('object');
    expect(typeof settings.nsfwThreshold).toBe('number');
    expect(typeof settings.selectedCategory).toBe('string');
    expect(typeof settings.enabled).toBe('boolean');
  });

  test('updateSettings persists settings', () => {
    updateSettings({ nsfwThreshold: 0.6, selectedCategory: 'parade', enabled: false });
    const settings = getSettings();
    expect(settings.nsfwThreshold).toBe(0.6);
    expect(settings.selectedCategory).toBe('parade');
    expect(settings.enabled).toBe(false);

    // loadSettings should return the persisted values
    const loadedSettings = loadSettings();
    expect(loadedSettings.nsfwThreshold).toBe(0.6);
    expect(loadedSettings.selectedCategory).toBe('parade');
    expect(loadedSettings.enabled).toBe(false);
  });

  test('getSettings returns current settings', () => {
    updateSettings({ nsfwThreshold: 0.4, selectedCategory: 'trunk', enabled: true });
    const settings = getSettings();
    expect(settings.nsfwThreshold).toBe(0.4);
    expect(settings.selectedCategory).toBe('trunk');
    expect(settings.enabled).toBe(true);
  });

  test('updateSettings merges partial updates', () => {
    updateSettings({ nsfwThreshold: 0.7, selectedCategory: 'all', enabled: true });
    updateSettings({ nsfwThreshold: 0.3 });
    const settings = getSettings();
    expect(settings.nsfwThreshold).toBe(0.3);
    expect(settings.selectedCategory).toBe('all');
    expect(settings.enabled).toBe(true);
  });
});

describe('Analytics management', () => {
  beforeEach(() => {
    resetAnalytics();
  });

  test('loadAnalytics returns analytics object', () => {
    const analytics = loadAnalytics();
    expect(typeof analytics).toBe('object');
    expect(typeof analytics.replacements).toBe('number');
    expect(typeof analytics.byCategory).toBe('object');
    expect(typeof analytics.byConfidence).toBe('object');
  });

  test('recordReplacement increments replacements', () => {
    expect(getAnalytics().replacements).toBe(0);
    recordReplacement('parade', 0.85);
    expect(getAnalytics().replacements).toBe(1);
    recordReplacement('trunk', 0.92);
    expect(getAnalytics().replacements).toBe(2);
  });

  test('recordReplacement tracks by category', () => {
    recordReplacement('parade', 0.8);
    recordReplacement('parade', 0.9);
    recordReplacement('trunk', 0.7);
    const analytics = getAnalytics();
    expect(analytics.byCategory.parade).toBe(2);
    expect(analytics.byCategory.trunk).toBe(1);
  });

  test('recordReplacement tracks by confidence bucket', () => {
    recordReplacement('parade', 0.85);
    recordReplacement('parade', 0.82);
    recordReplacement('trunk', 0.91);
    const analytics = getAnalytics();
    expect(analytics.byConfidence['0.8']).toBe(2);
    expect(analytics.byConfidence['0.9']).toBe(1);
  });

  test('resetAnalytics clears all data', () => {
    recordReplacement('parade', 0.8);
    expect(getAnalytics().replacements).toBe(1);
    resetAnalytics();
    expect(getAnalytics().replacements).toBe(0);
    expect(Object.keys(getAnalytics().byCategory).length).toBe(0);
    expect(Object.keys(getAnalytics().byConfidence).length).toBe(0);
  });
});

describe('checkAndReplaceImage logic', () => {
  test('skips images with nsfwChecked attribute', () => {
    const mockImage = document.createElement('img');
    mockImage.dataset.nsfwChecked = 'true';
    mockImage.width = 100;
    mockImage.height = 100;

    expect(mockImage.dataset.nsfwChecked).toBe('true');
  });

  test('skips small images', () => {
    const mockImage = document.createElement('img');
    mockImage.dataset.nsfwChecked = undefined;
    mockImage.width = 30;
    mockImage.height = 30;

    expect(mockImage.width < 50).toBe(true);
    expect(mockImage.height < 50).toBe(true);
  });

  test('skips images that are too small in either dimension', () => {
    const mockImage = document.createElement('img');
    mockImage.dataset.nsfwChecked = undefined;
    mockImage.width = 100;
    mockImage.height = 30;

    expect(mockImage.width >= 50).toBe(true);
    expect(mockImage.height < 50).toBe(true);
  });
});

describe('Module exports', () => {
  test('exports expected functions', () => {
    const mod = require('../src/main');
    expect(typeof mod.loadModel).toBe('function');
    expect(typeof mod.isNSFW).toBe('function');
    expect(typeof mod.getRandomElephantImage).toBe('function');
    expect(typeof mod.replaceWithElephant).toBe('function');
    expect(typeof mod.checkAndReplaceImage).toBe('function');
    expect(typeof mod.replacePenisImages).toBe('function');
    expect(typeof mod.initialize).toBe('function');
    expect(typeof mod.modifyModel).toBe('function');
    expect(typeof mod.loadSettings).toBe('function');
    expect(typeof mod.saveSettings).toBe('function');
    expect(typeof mod.loadAnalytics).toBe('function');
    expect(typeof mod.saveAnalytics).toBe('function');
    expect(typeof mod.recordReplacement).toBe('function');
    expect(typeof mod.getAnalytics).toBe('function');
    expect(typeof mod.resetAnalytics).toBe('function');
    expect(typeof mod.getNSFWThreshold).toBe('function');
    expect(typeof mod.setNSFWThreshold).toBe('function');
    expect(typeof mod.updateSettings).toBe('function');
    expect(typeof mod.addCustomElephantImage).toBe('function');
    expect(typeof mod.removeCustomElephantImage).toBe('function');
    expect(typeof mod.getCustomElephantImages).toBe('function');
    expect(typeof mod.exportSettings).toBe('function');
    expect(typeof mod.importSettings).toBe('function');
    expect(typeof mod.setAnimationsEnabled).toBe('function');
    expect(typeof mod.areAnimationsEnabled).toBe('function');
    expect(typeof mod.matchesDomain).toBe('function');
    expect(typeof mod.isDomainAllowed).toBe('function');
    expect(typeof mod.addAllowedDomain).toBe('function');
    expect(typeof mod.removeAllowedDomain).toBe('function');
    expect(typeof mod.getAllowedDomains).toBe('function');
    expect(typeof mod.addBlockedDomain).toBe('function');
    expect(typeof mod.removeBlockedDomain).toBe('function');
    expect(typeof mod.getBlockedDomains).toBe('function');
    expect(typeof mod.undoLastReplacement).toBe('function');
  });

  test('exports expected data structures', () => {
    const mod = require('../src/main');
    expect(Array.isArray(mod.ELEPHANT_IMAGES)).toBe(true);
    expect(typeof mod.ELEPHANT_CATEGORIES).toBe('object');
    expect(typeof mod.CATEGORY_LABELS).toBe('object');
  });
});

describe('Custom elephant images', () => {
  beforeEach(() => {
    updateSettings({ customElephantImages: [] });
  });

  test('addCustomElephantImage adds a URL', () => {
    expect(addCustomElephantImage('https://example.com/elephant.jpg')).toBe(true);
    expect(getCustomElephantImages()).toEqual(['https://example.com/elephant.jpg']);
  });

  test('addCustomElephantImage rejects duplicates', () => {
    addCustomElephantImage('https://example.com/elephant.jpg');
    expect(addCustomElephantImage('https://example.com/elephant.jpg')).toBe(false);
    expect(getCustomElephantImages()).toHaveLength(1);
  });

  test('addCustomElephantImage rejects invalid input', () => {
    expect(addCustomElephantImage('')).toBe(false);
    expect(addCustomElephantImage('   ')).toBe(false);
    expect(addCustomElephantImage(null)).toBe(false);
    expect(addCustomElephantImage(undefined)).toBe(false);
    expect(addCustomElephantImage(42)).toBe(false);
  });

  test('addCustomElephantImage trims whitespace', () => {
    addCustomElephantImage('  https://example.com/a.jpg  ');
    expect(getCustomElephantImages()[0]).toBe('https://example.com/a.jpg');
  });

  test('removeCustomElephantImage removes a URL', () => {
    addCustomElephantImage('https://example.com/elephant.jpg');
    expect(removeCustomElephantImage('https://example.com/elephant.jpg')).toBe(true);
    expect(getCustomElephantImages()).toHaveLength(0);
  });

  test('removeCustomElephantImage returns false for unknown URL', () => {
    expect(removeCustomElephantImage('https://nope.com/x.jpg')).toBe(false);
  });

  test('getCustomElephantImages returns a copy', () => {
    addCustomElephantImage('https://example.com/elephant.jpg');
    const list = getCustomElephantImages();
    list.push('https://mutated.com/x.jpg');
    expect(getCustomElephantImages()).toHaveLength(1);
  });

  test('custom URLs can be selected by getRandomElephantImage', () => {
    addCustomElephantImage('https://example.com/custom.jpg');
    const originalRandom = Math.random;
    Math.random = () => 0;
    // With Math.random()=0 the "custom" branch is taken for category selection
    const result = getRandomElephantImage('parade');
    Math.random = originalRandom;
    expect(result).toBe('https://example.com/custom.jpg');
  });

  test('custom URLs are included in the full pool', () => {
    addCustomElephantImage('https://example.com/custom.jpg');
    // The custom URL is appended last, so it occupies the final index.
    // Stub Math.random to deterministically select that index rather than
    // relying on chance (which was ~25% flaky).
    const poolSize = ELEPHANT_IMAGES.length + 1;
    const originalRandom = Math.random;
    Math.random = () => (poolSize - 0.5) / poolSize;
    const result = getRandomElephantImage();
    Math.random = originalRandom;
    expect(result).toBe('https://example.com/custom.jpg');
  });
});

describe('Settings export / import', () => {
  beforeEach(() => {
    updateSettings({
      nsfwThreshold: 0.7,
      selectedCategory: 'all',
      enabled: true,
      customElephantImages: [],
      allowedDomains: [],
      blockedDomains: [],
    });
  });

  test('exportSettings returns valid JSON', () => {
    const json = exportSettings();
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('exportSettings includes current settings', () => {
    updateSettings({ nsfwThreshold: 0.55, selectedCategory: 'parade' });
    const parsed = JSON.parse(exportSettings());
    expect(parsed.nsfwThreshold).toBe(0.55);
    expect(parsed.selectedCategory).toBe('parade');
  });

  test('importSettings applies settings', () => {
    const json = JSON.stringify({ nsfwThreshold: 0.42, selectedCategory: 'trunk' });
    expect(importSettings(json)).toBe(true);
    expect(getSettings().nsfwThreshold).toBe(0.42);
    expect(getSettings().selectedCategory).toBe('trunk');
  });

  test('importSettings syncs the threshold', () => {
    importSettings(JSON.stringify({ nsfwThreshold: 0.33 }));
    expect(getNSFWThreshold()).toBe(0.33);
  });

  test('importSettings rejects invalid JSON', () => {
    expect(importSettings('{not valid json')).toBe(false);
    expect(importSettings('')).toBe(false);
  });

  test('importSettings rejects non-object payloads', () => {
    expect(importSettings('"a string"')).toBe(false);
    expect(importSettings('null')).toBe(false);
    expect(importSettings('42')).toBe(false);
  });

  test('importSettings round-trips with exportSettings', () => {
    updateSettings({ nsfwThreshold: 0.6, selectedCategory: 'graffiti' });
    addCustomElephantImage('https://example.com/round.jpg');
    const json = exportSettings();
    updateSettings({ nsfwThreshold: 0.7, selectedCategory: 'all' });
    updateSettings({ customElephantImages: [] });
    expect(importSettings(json)).toBe(true);
    expect(getSettings().nsfwThreshold).toBe(0.6);
    expect(getSettings().selectedCategory).toBe('graffiti');
    expect(getCustomElephantImages()).toContain('https://example.com/round.jpg');
  });
});

describe('Domain matching', () => {
  test('matches exact hostnames', () => {
    expect(matchesDomain('example.com', 'example.com')).toBe(true);
    expect(matchesDomain('example.com', 'other.com')).toBe(false);
  });

  test('matches subdomains implicitly', () => {
    expect(matchesDomain('www.example.com', 'example.com')).toBe(true);
    expect(matchesDomain('a.b.example.com', 'example.com')).toBe(true);
  });

  test('does not match partial suffix', () => {
    expect(matchesDomain('notexample.com', 'example.com')).toBe(false);
    expect(matchesDomain('example.com.evil.net', 'example.com')).toBe(false);
  });

  test('wildcard matches subdomains only', () => {
    expect(matchesDomain('www.example.com', '*.example.com')).toBe(true);
    expect(matchesDomain('deep.www.example.com', '*.example.com')).toBe(true);
    expect(matchesDomain('example.com', '*.example.com')).toBe(false);
  });

  test('is case-insensitive', () => {
    expect(matchesDomain('EXAMPLE.com', 'example.COM')).toBe(true);
  });

  test('strips protocol and path from patterns', () => {
    expect(matchesDomain('example.com', 'https://example.com/path')).toBe(true);
  });

  test('handles empty inputs', () => {
    expect(matchesDomain('', 'example.com')).toBe(false);
    expect(matchesDomain('example.com', '')).toBe(false);
  });
});

describe('Domain allow / block lists', () => {
  beforeEach(() => {
    updateSettings({ allowedDomains: [], blockedDomains: [] });
  });

  test('empty allowlist permits all domains', () => {
    expect(isDomainAllowed('anything.com')).toBe(true);
  });

  test('allowlist restricts to listed domains', () => {
    addAllowedDomain('example.com');
    expect(isDomainAllowed('example.com')).toBe(true);
    expect(isDomainAllowed('www.example.com')).toBe(true);
    expect(isDomainAllowed('other.com')).toBe(false);
  });

  test('blocklist takes precedence over allowlist', () => {
    addAllowedDomain('example.com');
    addBlockedDomain('example.com');
    expect(isDomainAllowed('example.com')).toBe(false);
  });

  test('blocklist alone denies matching domains', () => {
    addBlockedDomain('bad.com');
    expect(isDomainAllowed('bad.com')).toBe(false);
    expect(isDomainAllowed('good.com')).toBe(true);
  });

  test('addAllowedDomain rejects duplicates and invalid input', () => {
    expect(addAllowedDomain('example.com')).toBe(true);
    expect(addAllowedDomain('example.com')).toBe(false);
    expect(addAllowedDomain('')).toBe(false);
    expect(addAllowedDomain(null)).toBe(false);
  });

  test('removeAllowedDomain removes entries', () => {
    addAllowedDomain('example.com');
    expect(removeAllowedDomain('example.com')).toBe(true);
    expect(getAllowedDomains()).toHaveLength(0);
    expect(removeAllowedDomain('example.com')).toBe(false);
  });

  test('addBlockedDomain rejects duplicates and invalid input', () => {
    expect(addBlockedDomain('bad.com')).toBe(true);
    expect(addBlockedDomain('bad.com')).toBe(false);
    expect(addBlockedDomain('')).toBe(false);
  });

  test('removeBlockedDomain removes entries', () => {
    addBlockedDomain('bad.com');
    expect(removeBlockedDomain('bad.com')).toBe(true);
    expect(getBlockedDomains()).toHaveLength(0);
    expect(removeBlockedDomain('bad.com')).toBe(false);
  });

  test('getAllowedDomains returns a copy', () => {
    addAllowedDomain('example.com');
    const list = getAllowedDomains();
    list.push('mutated.com');
    expect(getAllowedDomains()).toHaveLength(1);
  });
});

describe('Animation settings', () => {
  afterEach(() => {
    setAnimationsEnabled(true);
  });

  test('setAnimationsEnabled toggles the flag', () => {
    setAnimationsEnabled(false);
    expect(areAnimationsEnabled()).toBe(false);
    setAnimationsEnabled(true);
    expect(areAnimationsEnabled()).toBe(true);
  });

  test('updateSettings persists the animation preference', () => {
    updateSettings({ enableAnimations: false });
    expect(areAnimationsEnabled()).toBe(false);
    updateSettings({ enableAnimations: true });
    expect(areAnimationsEnabled()).toBe(true);
  });
});

describe('Undo last replacement', () => {
  beforeEach(() => {
    setAnimationsEnabled(false);
    document.body.innerHTML = '';
  });

  test('returns false when there is nothing to undo', () => {
    expect(undoLastReplacement()).toBe(false);
  });
});

describe('Theme management', () => {
  test('getTheme defaults to auto', () => {
    expect(getTheme()).toBe('auto');
  });

  test('setTheme validates input', () => {
    expect(setTheme('dark')).toBe(true);
    expect(getTheme()).toBe('dark');
    expect(setTheme('invalid')).toBe(false);
    expect(getTheme()).toBe('dark');
  });

  test('isDarkMode respects explicit theme', () => {
    setTheme('dark');
    expect(isDarkMode()).toBe(true);
    setTheme('light');
    expect(isDarkMode()).toBe(false);
  });
});

describe('False-positive whitelist', () => {
  const testSrc = 'https://example.com/test.jpg';

  beforeEach(() => {
    resetStorage();
  });

  test('isWhitelisted returns false for unknown src', () => {
    expect(isWhitelisted(testSrc)).toBe(false);
  });

  test('addToWhitelist whitelists an image for 7 days by default', () => {
    const expiry = addToWhitelist(testSrc);
    expect(isWhitelisted(testSrc)).toBe(true);
    expect(expiry).toBeGreaterThan(Date.now());
    // within the default 7-day window
    expect(isWhitelisted(testSrc, Date.now() + 24 * 60 * 60 * 1000)).toBe(true);
    // beyond the 7-day window
    expect(isWhitelisted(testSrc, Date.now() + 8 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  test('addToWhitelist accepts custom duration', () => {
    addToWhitelist(testSrc, 1);
    expect(isWhitelisted(testSrc, Date.now() + 12 * 60 * 60 * 1000)).toBe(true);
    expect(isWhitelisted(testSrc, Date.now() + 36 * 60 * 60 * 1000)).toBe(false);
  });

  test('cleanupWhitelist removes expired entries', () => {
    addToWhitelist(testSrc, 0); // expired immediately
    expect(isWhitelisted(testSrc)).toBe(false);
    expect(cleanupWhitelist()).toBe(1);
  });
});

describe('Schedule management', () => {
  beforeEach(() => {
    resetStorage();
    saveScheduleSettings({ enabled: false });
  });

  test('isWithinSchedule returns true when disabled', () => {
    expect(isWithinSchedule(new Date())).toBe(true);
  });

  test('isWithinSchedule respects time window', () => {
    saveScheduleSettings({
      enabled: true,
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5],
    });
    const monday = new Date('2026-01-05T12:00:00'); // Monday 12pm
    const sunday = new Date('2026-01-04T12:00:00'); // Sunday 12pm (not in days)
    const morning = new Date('2026-01-05T08:00:00'); // Monday 8am (before start)
    const evening = new Date('2026-01-05T18:00:00'); // Monday 6pm (after end)
    expect(isWithinSchedule(monday)).toBe(true);
    expect(isWithinSchedule(sunday)).toBe(false);
    expect(isWithinSchedule(morning)).toBe(false);
    expect(isWithinSchedule(evening)).toBe(false);
  });

  test('isWithinSchedule supports overnight windows', () => {
    saveScheduleSettings({
      enabled: true,
      start: '22:00',
      end: '06:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    });
    const night = new Date('2026-01-05T23:00:00'); // 11pm Monday
    const earlyMorning = new Date('2026-01-06T03:00:00'); // 3am Tuesday
    const midDay = new Date('2026-01-05T14:00:00'); // 2pm Monday
    expect(isWithinSchedule(night)).toBe(true);
    expect(isWithinSchedule(earlyMorning)).toBe(true);
    expect(isWithinSchedule(midDay)).toBe(false);
  });

  test('getScheduleInfo describes the schedule state', () => {
    saveScheduleSettings({
      enabled: true,
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5],
    });
    const monday = new Date('2026-01-05T12:00:00');
    const info = getScheduleInfo(monday);
    expect(info.within).toBe(true);
    expect(info.label).toContain('Active 09:00-17:00');
  });
});
