// tests/helpers/index.js - Shared test utilities
import { vi } from 'vitest';

/**
 * Create a mock CapabilityDetector
 * @param {string} tier - Security tier (green, yellow, red, blocked)
 * @returns {Object} Mock capability detector
 */
export function createMockCapabilityDetector(tier = 'green') {
  const tierConfigs = {
    green: {
      sessionDuration: 15 * 60 * 1000,
      maxOperations: Infinity,
      autoLock: true
    },
    yellow: {
      sessionDuration: 5 * 60 * 1000,
      maxOperations: 100,
      autoLock: false
    },
    red: {
      sessionDuration: 30 * 1000,
      maxOperations: 10,
      autoLock: false
    },
    blocked: {
      sessionDuration: 0,
      maxOperations: 0,
      autoLock: false
    }
  };

  const capabilities = {
    webauthn: tier !== 'blocked',
    subtleCrypto: true,
    visibilityApi: tier === 'green',
    indexedDB: true,
    timestamp: Date.now()
  };

  return {
    detect: vi.fn().mockReturnValue(capabilities),
    getTier: vi.fn().mockReturnValue(tier),
    getRecommendedConfig: vi.fn().mockReturnValue(tierConfigs[tier]),
    getStatus: vi.fn().mockReturnValue({
      emoji: tier === 'green' ? '🔒' : tier === 'yellow' ? '⚠️' : '❌',
      title: `${tier} tier`,
      description: `Test mode - ${tier}`,
      color: tier === 'green' ? '#4caf50' : tier === 'yellow' ? '#ff9800' : '#f44336',
      warnings: tier === 'blocked' ? ['WebAuthn not supported'] : []
    }),
    getAnalytics: vi.fn().mockReturnValue({
      tier,
      ...capabilities
    })
  };
}

/**
 * Create a mock PasskeyService
 * @returns {Object} Mock passkey service
 */
export function createMockPasskeyService() {
  return {
    isSupported: () => true,
    createCredential: vi.fn().mockResolvedValue({
      rawId: new ArrayBuffer(32)
    }),
    authenticate: vi.fn().mockResolvedValue({
      response: { signature: new ArrayBuffer(64) }
    })
  };
}

/**
 * Assert that a session is active
 * @param {SessionManager} sessionManager - Session manager instance
 * @param {string} provider - Provider name
 */
export function expectSessionActive(sessionManager, provider) {
  expect(sessionManager.hasSession(provider)).toBe(true);
  expect(sessionManager.getApiKey(provider)).toBeTruthy();
}

/**
 * Assert that a session is inactive
 * @param {SessionManager} sessionManager - Session manager instance
 * @param {string} provider - Provider name
 */
export function expectSessionInactive(sessionManager, provider) {
  expect(sessionManager.hasSession(provider)).toBe(false);
  expect(sessionManager.getApiKey(provider)).toBeNull();
}

/**
 * Assert that an event was emitted with expected data
 * @param {Function} callback - Mock callback function
 * @param {Object} expectedData - Expected event data (uses objectContaining)
 */
export function expectEvent(callback, expectedData) {
  expect(callback).toHaveBeenCalledWith(expect.objectContaining(expectedData));
}

/**
 * Assert that an event was emitted exactly once
 * @param {Function} callback - Mock callback function
 * @param {Object} expectedData - Expected event data (uses objectContaining)
 */
export function expectEventOnce(callback, expectedData) {
  expect(callback).toHaveBeenCalledTimes(1);
  expectEvent(callback, expectedData);
}

/**
 * Standard test lifecycle setup with fake timers
 */
export function setupAsyncTests() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
}

/**
 * Advance fake timers by specified duration
 * @param {number} ms - Milliseconds to advance
 */
export function advanceTime(ms) {
  vi.advanceTimersByTime(ms);
}

/**
 * Wait for async operations to complete
 * @returns {Promise<void>}
 */
export function waitForAsync() {
  return new Promise(resolve => setTimeout(resolve, 0));
}