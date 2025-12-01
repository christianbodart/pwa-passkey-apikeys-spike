import 'fake-indexeddb/auto';
import { webcrypto } from 'crypto';

// Mock Web Crypto API
global.crypto = webcrypto;

// Mock WebAuthn navigator.credentials
global.navigator.credentials = {
  create: vi.fn(),
  get: vi.fn()
};

// Mock location for passkey RP ID
global.location = { hostname: 'localhost' };
