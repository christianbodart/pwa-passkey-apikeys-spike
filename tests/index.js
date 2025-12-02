// tests/helpers/index.js
/**
 * Central export point for all test helpers
 * Import from here to use helpers across test files
 */

// Crypto helpers
export {
  generateTestKey,
  generateIV,
  generateChallenge,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  generateKeyMaterial,
  encryptWithNewKey,
  decryptData,
  testRoundtrip,
  getTestData,
  exportTestKey,
  importTestKey,
  testKeyPortability
} from './crypto-helpers.js';

// Storage helpers
export {
  initTestDB,
  putRecord,
  getRecord,
  deleteRecord,
  getAllRecords,
  clearAllRecords,
  createTestRecord,
  seedRecords,
  closeDB,
  deleteDB,
  withTimeout,
  transactionComplete,
  constants
} from './storage-helpers.js';

// Passkey helpers
export {
  createCredentialOptions,
  getAssertionOptions,
  createTestCredential,
  getTestAssertion,
  createMockCredential,
  createMockAssertion,
  setupPasskeyMocks,
  verifyCredentialCreation,
  verifyAssertion,
  createUserId,
  generateCredentialId,
  DEFAULT_CONFIG
} from './passkey-helpers.js';
