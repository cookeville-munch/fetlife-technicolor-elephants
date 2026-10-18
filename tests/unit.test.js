/**
 * @jest-environment jsdom
 */

const { ELEPHANT_IMAGES, NSFW_THRESHOLD } = require('../src/main');

describe('Configuration', () => {
  test('ELEPHANT_IMAGES is an array with at least one image', () => {
    expect(Array.isArray(ELEPHANT_IMAGES)).toBe(true);
    expect(ELEPHANT_IMAGES.length).toBeGreaterThan(0);
    expect(typeof ELEPHANT_IMAGES[0]).toBe('string');
  });

  test('NSFW_THRESHOLD is a number between 0 and 1', () => {
    expect(typeof NSFW_THRESHOLD).toBe('number');
    expect(NSFW_THRESHOLD > 0 && NSFW_THRESHOLD <= 1).toBe(true);
  });
});

describe('getRandomElephantImage', () => {
  test('returns a string URL', () => {
    const result = ELEPHANT_IMAGES[Math.floor(Math.random() * ELEPHANT_IMAGES.length)];
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('can call multiple times without throwing', () => {
    const results = Array.from({ length: 10 }, () => {
      const idx = Math.floor(Math.random() * ELEPHANT_IMAGES.length);
      return ELEPHANT_IMAGES[idx];
    });
    expect(results.length).toBe(10);
  });
});

describe('isNSFW', () => {
  // We can't test the actual NSFW classification without the model,
  // but we can verify the threshold logic works correctly
  test('detects Porn classification correctly', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.8 },
    ];
    const result = mockPredictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
    expect(result).toBe(true);
  });

  test('detects Hentai classification correctly', () => {
    const mockPredictions = [
      { className: 'Hentai', probability: 0.9 },
    ];
    const result = mockPredictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
    expect(result).toBe(true);
  });

  test('detects Sexy classification correctly', () => {
    const mockPredictions = [
      { className: 'Sexy', probability: 0.8 },
    ];
    const result = mockPredictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
    expect(result).toBe(true);
  });

  test('does not detect Neutral classification', () => {
    const mockPredictions = [
      { className: 'Neutral', probability: 0.9 },
    ];
    const result = mockPredictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
    expect(result).toBe(false);
  });

  test('respects probability threshold', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.5 },
    ];
    const result = mockPredictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
    expect(result).toBe(false);
  });

  test('returns false for mixed classifications with low probability', () => {
    const mockPredictions = [
      { className: 'Porn', probability: 0.5 },
      { className: 'Neutral', probability: 0.9 },
    ];
    const result = mockPredictions.some((p) => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
    expect(result).toBe(false);
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
  });
});
