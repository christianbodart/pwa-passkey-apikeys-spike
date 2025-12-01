// tests/setup.js
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { vi } from 'vitest';

// Mock Web Crypto API using Object.defineProperty
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: true
  });
}

// Mock TextEncoder/TextDecoder (needed for crypto operations)
if (!globalThis.TextEncoder) {
  const { TextEncoder, TextDecoder } = require('util');
  Object.defineProperty(globalThis, 'TextEncoder', {
    value: TextEncoder,
    writable: false,
    configurable: true
  });
  Object.defineProperty(globalThis, 'TextDecoder', {
    value: TextDecoder,
    writable: false,
    configurable: true
  });
}

// Mock navigator with credentials API
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {},
    writable: true,
    configurable: true
  });
}

Object.defineProperty(globalThis.navigator, 'credentials', {
  value: {
    create: vi.fn(),
    get: vi.fn()
  },
  writable: true,
  configurable: true
});

// Mock location for passkey RP ID
if (!globalThis.location) {
  Object.defineProperty(globalThis, 'location', {
    value: { 
      hostname: 'localhost',
      href: 'http://localhost:3000'
    },
    writable: true,
    configurable: true
  });
}

// Mock document for DOM interactions
if (!globalThis.document) {
  Object.defineProperty(globalThis, 'document', {
    value: {
      getElementById: vi.fn((id) => ({
        onclick: null,
        textContent: '',
        value: ''
      })),
      addEventListener: vi.fn()
    },
    writable: true,
    configurable: true
  });
}
