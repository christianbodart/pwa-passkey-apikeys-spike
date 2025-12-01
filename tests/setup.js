// tests/setup.js - Global test setup
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock WebAuthn API
global.PublicKeyCredential = class PublicKeyCredential {
  static isConditionalMediationAvailable() {
    return Promise.resolve(true);
  }
};

// Mock navigator.credentials
global.navigator.credentials = {
  create: vi.fn(),
  get: vi.fn()
};

// Mock crypto API (happy-dom provides this, but ensure it's complete)
if (!global.crypto.subtle) {
  global.crypto.subtle = crypto.subtle;
}

// Mock location
if (!global.location) {
  global.location = {
    hostname: 'localhost',
    protocol: 'https:',
    href: 'https://localhost/'
  };
}

// Mock document.visibilityState
if (!global.document.visibilityState) {
  Object.defineProperty(global.document, 'visibilityState', {
    value: 'visible',
    writable: true,
    configurable: true
  });
}

// Suppress console errors in tests (optional)
// global.console.error = vi.fn();
// global.console.warn = vi.fn();
