/**
 * @jest-environment jsdom
 */

const {
  checkAndReplaceImage,
  replaceWithElephant,
  ELEPHANT_IMAGES,
  modifyModel,
} = require('../src/main');

describe('Integration Tests: Image Replacement Flow', () => {
  let originalNsfwModel;

  beforeEach(() => {
    document.body.innerHTML = '';
    originalNsfwModel = require('../src/main').nsfwModel;
    modifyModel(originalNsfwModel);
  });

  afterEach(() => {
    modifyModel(originalNsfwModel);
  });

  test('replaces NSFW image with elephant when classified as Porn', async () => {
    const img = document.createElement('img');
    img.src = 'test-image-url.jpg';
    img.width = 100;
    img.height = 100;
    document.body.appendChild(img);

    const mockClassify = jest.fn().mockResolvedValue([
      { className: 'Porn', probability: 0.85 },
      { className: 'Neutral', probability: 0.15 },
    ]);

    const mockModel = {
      classify: mockClassify,
    };

    modifyModel(mockModel);

    await checkAndReplaceImage(img);

    expect(img.dataset.nsfwChecked).toBe('true');
  });

  test('does not replace image when classified as Neutral', async () => {
    const img = document.createElement('img');
    img.src = 'safe-image-url.jpg';
    img.width = 100;
    img.height = 100;
    document.body.appendChild(img);

    const mockClassify = jest.fn().mockResolvedValue([
      { className: 'Neutral', probability: 0.95 },
    ]);

    const mockModel = {
      classify: mockClassify,
    };

    modifyModel(mockModel);

    await checkAndReplaceImage(img);

    expect(img.src).toBe('http://localhost/safe-image-url.jpg');
  });

  test('does not replace image when probability below threshold', async () => {
    const img = document.createElement('img');
    img.src = 'borderline-image.jpg';
    img.width = 100;
    img.height = 100;
    document.body.appendChild(img);

    const mockClassify = jest.fn().mockResolvedValue([
      { className: 'Porn', probability: 0.5 },
    ]);

    const mockModel = {
      classify: mockClassify,
    };

    modifyModel(mockModel);

    await checkAndReplaceImage(img);

    expect(img.src).toBe('http://localhost/borderline-image.jpg');
  });

  test('handles Hentai classification correctly', async () => {
    const img = document.createElement('img');
    img.src = 'hentai-image.jpg';
    img.width = 100;
    img.height = 100;
    document.body.appendChild(img);

    const mockClassify = jest.fn().mockResolvedValue([
      { className: 'Hentai', probability: 0.9 },
    ]);

    const mockModel = {
      classify: mockClassify,
    };

    modifyModel(mockModel);

    await checkAndReplaceImage(img);

    expect(img.dataset.nsfwChecked).toBe('true');
  });

  test('handles Sexy classification correctly', async () => {
    const img = document.createElement('img');
    img.src = 'sexy-image.jpg';
    img.width = 100;
    img.height = 100;
    document.body.appendChild(img);

    const mockClassify = jest.fn().mockResolvedValue([
      { className: 'Sexy', probability: 0.8 },
    ]);

    const mockModel = {
      classify: mockClassify,
    };

    modifyModel(mockModel);

    await checkAndReplaceImage(img);

    expect(img.dataset.nsfwChecked).toBe('true');
  });

  test('handles classify errors gracefully', async () => {
    const img = document.createElement('img');
    img.src = 'error-image.jpg';
    img.width = 100;
    img.height = 100;
    document.body.appendChild(img);

    const mockClassify = jest.fn().mockRejectedValue(new Error('Network error'));

    const mockModel = {
      classify: mockClassify,
    };

    modifyModel(mockModel);

    await expect(checkAndReplaceImage(img)).resolves.not.toThrow();
    expect(img.src).toBe('http://localhost/error-image.jpg');
  });

  test('processes multiple images concurrently', async () => {
    document.body.innerHTML = `
      <img src="safe1.jpg" width="100" height="100">
      <img src="nsfw1.jpg" width="100" height="100">
      <img src="safe2.jpg" width="100" height="100">
      <img src="nsfw2.jpg" width="100" height="100">
    `;

    // Mock classify to alternate between NSFW (Porn) and Safe (Neutral)
    let callCount = 0;
    const mockClassify = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve([{ className: 'Porn', probability: 0.9 }]);
      }
      return Promise.resolve([{ className: 'Neutral', probability: 0.9 }]);
    });

    const mockModel = { classify: mockClassify };
    modifyModel(mockModel);

    // Mock Math.random to always return 0 for predictable testing
    const originalRandom = Math.random;
    Math.random = () => 0;

    const images = document.querySelectorAll('img');
    const promises = Array.from(images).map(checkAndReplaceImage);
    await Promise.all(promises);

    // Restore original Math.random
    Math.random = originalRandom;

    const elephantUrl = ELEPHANT_IMAGES[0]; // Use first image for consistent testing
    const replacedCount = Array.from(document.querySelectorAll('img'))
      .filter((img) => img.src === elephantUrl).length;

    expect(replacedCount).toBe(2);
  });
});

describe('replaceWithElephant', () => {
  test('replaces src with elephant image', () => {
    const img = document.createElement('img');
    img.src = 'old-image.jpg';

    // Mock Math.random to always return 0 for predictable testing
    const originalRandom = Math.random;
    Math.random = () => 0;

    replaceWithElephant(img);

    expect(img.src).toBe(ELEPHANT_IMAGES[0]);

    // Restore original Math.random
    Math.random = originalRandom;
  });

  test('clears srcset', () => {
    const img = document.createElement('img');
    img.srcset = 'old-set 1x, old-set2 2x';

    replaceWithElephant(img);

    expect(img.srcset).toBe('');
  });
});
