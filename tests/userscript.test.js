/**
 * @jest-environment jsdom
 */

/**
 * Tests for the userscript's in-page UI: accessibility semantics, focus
 * management, and keyboard navigation.
 *
 * The userscript is an IIFE that auto-initializes on load, so we set up the
 * globals it depends on (@require'd tf/nsfwjs and the GM_* storage APIs)
 * before evaluating it.
 */

const USERSCRIPT_PATH = '../fetlife-technicolor-elephants.user.js';
const fs = require('fs');
const path = require('path');

// Minimal in-memory GM_* storage implementation
const gmStore = {};

global.GM_getValue = jest.fn((key) => gmStore[key]);
global.GM_setValue = jest.fn((key, value) => {
  gmStore[key] = value;
});

// Minimal tf / nsfwjs stubs
global.tf = {
  setBackend: jest.fn(),
  ready: jest.fn().mockResolvedValue(true),
};
global.nsfwjs = {
  load: jest.fn().mockResolvedValue({
    classify: jest.fn().mockResolvedValue([{ className: 'Neutral', probability: 0.99 }]),
  }),
};

const userscriptSource = fs.readFileSync(path.resolve(__dirname, USERSCRIPT_PATH), 'utf8');

/**
 * Evaluates the userscript fresh and returns the resulting DOM.
 * @param {Object} [presetStore] - Storage entries to seed before evaluation
 */
function loadUserscript(presetStore) {
  document.body.innerHTML = '';
  Object.keys(gmStore).forEach((key) => delete gmStore[key]);
  if (presetStore) {
    Object.assign(gmStore, presetStore);
  }
  // eslint-disable-next-line no-eval
  eval(userscriptSource);
  return document.body;
}

describe('Userscript accessibility', () => {
  beforeEach(() => {
    loadUserscript();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Toggle button', () => {
    test('is a button with accessible name and expanded state', () => {
      const btn = document.getElementById('fte-toggle-btn');
      expect(btn).not.toBeNull();
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('aria-label')).toContain('FetLife Technicolor Elephants');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.getAttribute('aria-controls')).toBe('fte-settings-panel');
    });

    test('badge is hidden from assistive tech but count is in the label', () => {
      const badge = document.getElementById('fte-toggle-badge');
      expect(badge.getAttribute('aria-hidden')).toBe('true');
    });

    test('aria-label reflects replacement count', () => {
      loadUserscript({
        fte_analytics: JSON.stringify({ replacements: 3, byCategory: {}, byConfidence: {} }),
      });
      const btn = document.getElementById('fte-toggle-btn');
      expect(btn.getAttribute('aria-label')).toContain('3 images replaced');
    });

    test('aria-label uses singular form for one replacement', () => {
      loadUserscript({
        fte_analytics: JSON.stringify({ replacements: 1, byCategory: {}, byConfidence: {} }),
      });
      const btn = document.getElementById('fte-toggle-btn');
      expect(btn.getAttribute('aria-label')).toContain('1 image replaced');
    });
  });

  describe('Settings panel semantics', () => {
    beforeEach(() => {
      document.getElementById('fte-toggle-btn').click();
    });

    test('panel is a labelled dialog', () => {
      const panel = document.getElementById('fte-settings-panel');
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-labelledby')).toBe('fte-panel-title');
      expect(document.getElementById('fte-panel-title')).not.toBeNull();
    });

    test('toggle button reports expanded state while open', () => {
      expect(document.getElementById('fte-toggle-btn').getAttribute('aria-expanded')).toBe('true');
    });

    test('every form control has an associated label', () => {
      const panel = document.getElementById('fte-settings-panel');
      const controls = panel.querySelectorAll('input, select, textarea');
      expect(controls.length).toBeGreaterThan(0);
      controls.forEach((control) => {
        const label = panel.querySelector(`label[for="${control.id}"]`);
        expect(label).not.toBeNull();
        expect(label.textContent.trim().length).toBeGreaterThan(0);
      });
    });

    test('stats and import message are live regions', () => {
      const stats = document.getElementById('fte-stats');
      expect(stats.getAttribute('role')).toBe('status');
      expect(stats.getAttribute('aria-live')).toBe('polite');

      const msg = document.getElementById('fte-import-msg');
      expect(msg.getAttribute('role')).toBe('status');
      expect(msg.getAttribute('aria-live')).toBe('polite');
    });

    test('threshold slider has a description', () => {
      const slider = document.getElementById('fte-threshold');
      const help = document.getElementById('fte-threshold-help');
      expect(slider.getAttribute('aria-describedby')).toBe('fte-threshold-help');
      expect(help).not.toBeNull();
    });

    test('lists are marked up as lists', () => {
      expect(document.getElementById('fte-custom-list').getAttribute('role')).toBe('list');
      expect(document.getElementById('fte-allowed-list').getAttribute('role')).toBe('list');
      expect(document.getElementById('fte-blocked-list').getAttribute('role')).toBe('list');
    });

    test('remove buttons have descriptive labels', () => {
      const addBtn = document.getElementById('fte-add-custom');
      const input = document.getElementById('fte-custom-url');
      input.value = 'https://example.com/a.jpg';
      addBtn.click();

      const removeBtn = document.querySelector('#fte-custom-list button');
      expect(removeBtn.getAttribute('aria-label')).toBe('Remove https://example.com/a.jpg');
    });

    test('close button has an accessible name', () => {
      const closeBtn = document.getElementById('fte-close-settings');
      expect(closeBtn.getAttribute('aria-label')).toBe('Close settings');
    });

    test('all buttons declare type=button to avoid accidental submits', () => {
      const panel = document.getElementById('fte-settings-panel');
      panel.querySelectorAll('button').forEach((btn) => {
        expect(btn.getAttribute('type')).toBe('button');
      });
    });
  });

  describe('Focus management', () => {
    test('focus moves into the panel when opened', () => {
      document.getElementById('fte-toggle-btn').click();
      expect(document.activeElement.id).toBe('fte-close-settings');
    });

    test('focus returns to the toggle button when closed', () => {
      const btn = document.getElementById('fte-toggle-btn');
      btn.click();
      document.getElementById('fte-close-settings').click();

      expect(document.getElementById('fte-settings-panel')).toBeNull();
      expect(document.activeElement.id).toBe('fte-toggle-btn');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    test('Escape closes the panel', () => {
      document.getElementById('fte-toggle-btn').click();
      const panel = document.getElementById('fte-settings-panel');

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      panel.dispatchEvent(event);

      expect(document.getElementById('fte-settings-panel')).toBeNull();
      expect(document.activeElement.id).toBe('fte-toggle-btn');
    });

    test('Tab wraps focus from last to first element', () => {
      document.getElementById('fte-toggle-btn').click();
      const panel = document.getElementById('fte-settings-panel');

      const focusables = Array.from(
        panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'),
      );
      const last = focusables[focusables.length - 1];
      last.focus();
      expect(document.activeElement).toBe(last);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      panel.dispatchEvent(event);

      expect(document.activeElement).toBe(focusables[0]);
    });

    test('Shift+Tab wraps focus from first to last element', () => {
      document.getElementById('fte-toggle-btn').click();
      const panel = document.getElementById('fte-settings-panel');

      const focusables = Array.from(
        panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'),
      );
      const first = focusables[0];
      first.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      panel.dispatchEvent(event);

      expect(document.activeElement).toBe(focusables[focusables.length - 1]);
    });
  });

  describe('Accessibility styles', () => {
    test('injects focus-visible and reduced-motion styles', () => {
      const style = document.getElementById('fte-a11y-styles');
      expect(style).not.toBeNull();
      expect(style.textContent).toContain(':focus-visible');
      expect(style.textContent).toContain('prefers-reduced-motion');
    });
  });

  describe('Panel behaviour', () => {
    test('reopening after close does not leak document click listeners', () => {
      const btn = document.getElementById('fte-toggle-btn');

      // Open and close several times; a leaked outside-click handler would
      // attempt to remove a panel that is already gone or double-remove.
      for (let i = 0; i < 3; i += 1) {
        btn.click();
        expect(document.getElementById('fte-settings-panel')).not.toBeNull();
        document.getElementById('fte-close-settings').click();
        expect(document.getElementById('fte-settings-panel')).toBeNull();
      }
    });

    test('adding a custom URL updates the list and persists', () => {
      document.getElementById('fte-toggle-btn').click();
      const input = document.getElementById('fte-custom-url');
      input.value = 'https://example.com/elephant.jpg';
      document.getElementById('fte-add-custom').click();

      const list = document.getElementById('fte-custom-list');
      expect(list.textContent).toContain('https://example.com/elephant.jpg');
      expect(gmStore.fte_settings).toContain('https://example.com/elephant.jpg');
    });

    test('adding a blocked domain persists', () => {
      document.getElementById('fte-toggle-btn').click();
      const input = document.getElementById('fte-blocked-domain');
      input.value = 'blocked.com';
      document.getElementById('fte-add-blocked').click();

      expect(document.getElementById('fte-blocked-list').textContent).toContain('blocked.com');
      expect(gmStore.fte_settings).toContain('blocked.com');
    });
  });
});
