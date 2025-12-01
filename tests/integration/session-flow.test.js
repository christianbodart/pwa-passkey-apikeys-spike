// tests/integration/session-flow.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PasskeyKeyManager } from '../../src/app.js';
import { SessionManager } from '../../src/session-manager.js';
import { StorageService } from '../../src/storage.js';
import { KeyManager } from '../../src/key-manager.js';
import { PasskeyService } from '../../src/passkey-service.js';
import { ProviderService } from '../../src/providers.js';
import { CapabilityDetector } from '../../src/capability-detector.js';
import 'fake-indexeddb/auto';

describe('Session Flow Integration', () => {
  let manager;
  let mockPasskeyService;
  let mockCapabilityDetector;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Mock CapabilityDetector to always return green tier
    mockCapabilityDetector = {
      detect: vi.fn().mockReturnValue({
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: true,
        timestamp: Date.now()
      }),
      getTier: vi.fn().mockReturnValue('green'),
      getRecommendedConfig: vi.fn().mockReturnValue({
        sessionDuration: 15 * 60 * 1000,
        maxOperations: Infinity,
        autoLock: true
      }),
      getStatus: vi.fn().mockReturnValue({
        emoji: '🔒',
        title: 'Maximum Security',
        description: 'Test mode',
        color: '#4caf50',
        warnings: []
      }),
      getAnalytics: vi.fn().mockReturnValue({
        tier: 'green',
        webauthn: true,
        subtleCrypto: true,
        visibilityApi: true,
        indexedDB: true
      })
    };

    // Mock PasskeyService
    mockPasskeyService = {
      isSupported: () => true,
      createCredential: vi.fn().mockResolvedValue({
        rawId: new ArrayBuffer(32)
      }),
      authenticate: vi.fn().mockResolvedValue({
        response: { signature: new ArrayBuffer(64) }
      })
    };

    manager = new PasskeyKeyManager({
      storage: new StorageService('test-db', 'test-store'),
      keyManager: new KeyManager(),
      providerService: new ProviderService(),
      passkeyService: mockPasskeyService,
      sessionManager: new SessionManager(),
      capabilityDetector: mockCapabilityDetector
    });

    await manager.init();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('First Use Flow', () => {
    it('requires passkey auth on first API call', async () => {
      // Setup
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      // Clear session to simulate fresh start
      manager.sessionManager.endAllSessions();
      mockPasskeyService.authenticate.mockClear();

      // First call requires auth
      const key = await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
      expect(key).toBe('sk-test-key');
    });

    it('starts session after first auth', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      manager.sessionManager.endAllSessions();
      await manager.retrieveKey('openai');

      expect(manager.sessionManager.hasSession('openai')).toBe(true);
    });
  });

  describe('Subsequent Use Flow', () => {
    it('does not require passkey auth when session active', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      // Session started by storeKey
      mockPasskeyService.authenticate.mockClear();

      // Second call uses session
      const key = await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).not.toHaveBeenCalled();
      expect(key).toBe('sk-test-key');
    });

    it('extends session on each use', async () => {
      const extendedCallback = vi.fn();
      manager.on('sessionExtended', extendedCallback);

      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      extendedCallback.mockClear();

      // Use session
      await manager.retrieveKey('openai');

      expect(extendedCallback).toHaveBeenCalledWith({
        provider: 'openai',
        duration: expect.any(Number)
      });
    });
  });

  describe('Session Expiry Flow', () => {
    it('requires passkey auth after session expires', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      // Fast forward past expiry (15 minutes default)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      mockPasskeyService.authenticate.mockClear();

      // Should require auth again
      await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
    });

    it('emits sessionExpired event', async () => {
      const expiredCallback = vi.fn();
      manager.on('sessionExpired', expiredCallback);

      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      expect(expiredCallback).toHaveBeenCalledWith({ provider: 'openai' });
    });
  });

  describe('Manual Lock Flow', () => {
    it('clears session when locked', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      expect(manager.sessionManager.hasSession('openai')).toBe(true);

      manager.lockSession('openai');

      expect(manager.sessionManager.hasSession('openai')).toBe(false);
    });

    it('requires passkey auth after manual lock', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key');

      manager.lockSession('openai');
      mockPasskeyService.authenticate.mockClear();

      await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
    });

    it('locks all sessions', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-test-key-1');

      await manager.createPasskey('anthropic');
      await manager.storeKey('anthropic', 'sk-test-key-2');

      manager.lockAllSessions();

      expect(manager.sessionManager.hasSession('openai')).toBe(false);
      expect(manager.sessionManager.hasSession('anthropic')).toBe(false);
    });
  });

  describe('Multi-Provider Sessions', () => {
    it('manages independent sessions per provider', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-openai-key');

      await manager.createPasskey('anthropic');
      await manager.storeKey('anthropic', 'sk-anthropic-key');

      expect(manager.sessionManager.hasSession('openai')).toBe(true);
      expect(manager.sessionManager.hasSession('anthropic')).toBe(true);
    });

    it('retrieves correct key per provider', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', 'sk-openai-key');

      await manager.createPasskey('anthropic');
      await manager.storeKey('anthropic', 'sk-anthropic-key');

      mockPasskeyService.authenticate.mockClear();

      expect(await manager.retrieveKey('openai')).toBe('sk-openai-key');
      expect(await manager.retrieveKey('anthropic')).toBe('sk-anthropic-key');
      expect(mockPasskeyService.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('Capability Detection', () => {
    it('emits capabilityDetected event on init', async () => {
      // Already initialized in beforeEach, check that mock was called
      expect(mockCapabilityDetector.detect).toHaveBeenCalled();
      expect(mockCapabilityDetector.getTier).toHaveBeenCalled();
    });

    it('provides capability information', () => {
      const capInfo = manager.getCapabilities();

      expect(capInfo).toHaveProperty('capabilities');
      expect(capInfo).toHaveProperty('tier');
      expect(capInfo).toHaveProperty('status');
      expect(capInfo).toHaveProperty('config');
      expect(capInfo).toHaveProperty('isBlocked');
    });
  });
});
