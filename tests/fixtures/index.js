// tests/fixtures/index.js - Test data and constants

/**
 * Test API keys for various providers
 */
export const TEST_KEYS = {
  openai: 'sk-openai-test-key-12345',
  anthropic: 'sk-anthropic-test-key-67890',
  google: 'sk-google-test-key-abcdef'
};

/**
 * Standard provider names for testing
 */
export const TEST_PROVIDERS = ['openai', 'anthropic', 'google'];

/**
 * Session durations by security tier (in milliseconds)
 */
export const SESSION_DURATIONS = {
  green: 15 * 60 * 1000,   // 15 minutes
  yellow: 5 * 60 * 1000,   // 5 minutes
  red: 30 * 1000,          // 30 seconds
  blocked: 0               // No session
};

/**
 * Max operations by security tier
 */
export const MAX_OPERATIONS = {
  green: Infinity,
  yellow: 100,
  red: 10,
  blocked: 0
};

/**
 * Test database names to avoid collision
 */
export const TEST_DB_NAMES = {
  integration: 'test-integration-db',
  unit: 'test-unit-db',
  session: 'test-session-db'
};

/**
 * Common test durations (in milliseconds)
 */
export const DURATIONS = {
  immediate: 0,
  short: 100,
  medium: 1000,
  long: 5000,
  sessionExpiry: SESSION_DURATIONS.green + 1000
};

/**
 * Mock ArrayBuffers for credentials
 */
export function createMockCredentialId(size = 32) {
  return new ArrayBuffer(size);
}

export function createMockSignature(size = 64) {
  return new ArrayBuffer(size);
}