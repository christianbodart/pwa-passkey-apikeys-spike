// tests/unit/capability-detector.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CapabilityDetector } from '../../src/capability-detector.js';

describe('CapabilityDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new CapabilityDetector();
  });

  describe('Feature Detection', () => {
    it('detects WebAuthn support', () => {
      expect(detector.hasWebAuthn()).toBe(true);
    });

    it('detects Web Crypto API support', () => {
      expect(detector.hasSubtleCrypto()).toBe(true);
    });

    it('detects Visibility API support', () => {
      expect(detector.hasVisibilityApi()).toBe(true);
    });

    it('detects IndexedDB support', () => {
      expect(detector.hasIndexedDB()).toBe(true);
    });

    it('checks conditional mediation availability', async () => {
      const result = await detector.hasConditionalMediation();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Detect All Capabilities', () => {
    it('returns all capability flags', () => {
      const capabilities = detector.detect();

      expect(capabilities).toHaveProperty('webauthn');
      expect(capabilities).toHaveProperty('subtleCrypto');
      expect(capabilities).toHaveProperty('visibilityApi');
      expect(capabilities).toHaveProperty('indexedDB');
      expect(capabilities).toHaveProperty('timestamp');
      expect(typeof capabilities.timestamp).toBe('number');
    });
  });

  describe('Tier Classification', () => {
    it('classifies green tier when all features available', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: true
      };

      const tier = detector.getTier(capabilities);
      expect(tier).toBe('green');
    });

    it('classifies yellow tier when visibility API missing', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: false,
        indexedDB: true
      };

      const tier = detector.getTier(capabilities);
      expect(tier).toBe('yellow');
    });

    it('classifies blocked tier when WebAuthn missing', () => {
      const capabilities = {
        webauthn: false,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: true
      };

      const tier = detector.getTier(capabilities);
      expect(tier).toBe('blocked');
    });

    it('classifies blocked tier when Crypto API missing', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: false,
        visibilityApi: true,
        indexedDB: true
      };

      const tier = detector.getTier(capabilities);
      expect(tier).toBe('blocked');
    });

    it('classifies blocked tier when IndexedDB missing', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: false
      };

      const tier = detector.getTier(capabilities);
      expect(tier).toBe('blocked');
    });
  });

  describe('Recommended Configuration', () => {
    it('returns green tier config', () => {
      const config = detector.getRecommendedConfig('green');

      expect(config.sessionDuration).toBe(15 * 60 * 1000);
      expect(config.maxOperations).toBe(Infinity);
      expect(config.autoLock).toBe(true);
      expect(config.description).toContain('Maximum Security');
    });

    it('returns yellow tier config', () => {
      const config = detector.getRecommendedConfig('yellow');

      expect(config.sessionDuration).toBe(5 * 60 * 1000);
      expect(config.maxOperations).toBe(1000);
      expect(config.autoLock).toBe(false);
      expect(config.description).toContain('Reduced Security');
    });

    it('returns blocked tier config', () => {
      const config = detector.getRecommendedConfig('blocked');

      expect(config.sessionDuration).toBe(0);
      expect(config.maxOperations).toBe(0);
      expect(config.autoLock).toBe(false);
      expect(config.description).toContain('unavailable');
    });
  });

  describe('Status Messages', () => {
    it('returns green tier status', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: true
      };

      const status = detector.getStatus('green', capabilities);

      expect(status.emoji).toBe('🔒');
      expect(status.title).toBe('Maximum Security');
      expect(status.color).toBe('#4caf50');
      expect(status.warnings).toHaveLength(0);
    });

    it('returns yellow tier status with warnings', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: false,
        indexedDB: true
      };

      const status = detector.getStatus('yellow', capabilities);

      expect(status.emoji).toBe('⚠️');
      expect(status.title).toBe('Reduced Security');
      expect(status.color).toBe('#ff9800');
      expect(status.warnings.length).toBeGreaterThan(0);
      expect(status.warnings[0]).toContain('Tab monitoring unavailable');
    });

    it('returns blocked tier status with all warnings', () => {
      const capabilities = {
        webauthn: false,
        subtleCrypto: false,
        visibilityApi: false,
        indexedDB: false
      };

      const status = detector.getStatus('blocked', capabilities);

      expect(status.emoji).toBe('❌');
      expect(status.title).toBe('BYOK Unavailable');
      expect(status.color).toBe('#f44336');
      expect(status.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics Data', () => {
    it('returns analytics payload without PII', () => {
      const capabilities = {
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: true,
        timestamp: Date.now()
      };

      const analytics = detector.getAnalytics(capabilities, 'green');

      expect(analytics).toHaveProperty('tier');
      expect(analytics).toHaveProperty('webauthn');
      expect(analytics).toHaveProperty('subtleCrypto');
      expect(analytics).toHaveProperty('visibilityApi');
      expect(analytics).toHaveProperty('indexedDB');
      expect(analytics).toHaveProperty('userAgent');
      expect(analytics).toHaveProperty('timestamp');

      // Should not contain PII
      expect(analytics).not.toHaveProperty('userId');
      expect(analytics).not.toHaveProperty('email');
      expect(analytics).not.toHaveProperty('ip');
    });
  });
});
