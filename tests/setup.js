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

// Mock WebAuthn navigator.credentials
if (!globalThis.navigator) {
  globalThis.navigator = {};
}

globalThis.navigator.credentials = {
  create: vi.fn(),
  get: vi.fn()
};

// Mock location for passkey RP ID
if (!globalThis.location) {
  globalThis.location = { hostname: 'localhost' };
}

// Mock TextEncoder/TextDecoder (needed for crypto operations)
if (!globalThis.TextEncoder) {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
