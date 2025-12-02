// tests/integration/session-flow.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PasskeyKeyManager } from '../../src/app.js';
import { SessionManager } from '../../src/session-manager.js';
import { StorageService } from '../../src/storage.js';
import { KeyManager } from '../../src/key-manager.js';
import { ProviderService } from '../../src/providers.js';
import {
  createMockCapabilityDetector,
  createMockPasskeyService,
  expectSessionActive,
  expectSessionInactive,
  expectEvent,
  advanceTime
} from '../helpers/index.js';
import { TEST_KEYS, DURATIONS, TEST_DB_NAMES } from '../fixtures/index.js';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

describe('Session Flow Integration', () => {
  let manager;
  let mockPasskeyService;
  let mockCapabilityDetector;

  beforeEach(async () => {
    vi.useFakeTimers();

    mockCapabilityDetector = createMockCapabilityDetector('green');
    mockPasskeyService = createMockPasskeyService();

    manager = new PasskeyKeyManager({
      storage: new StorageService(TEST_DB_NAMES.session, 'test-store'),
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
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      // Clear session to simulate fresh start
      manager.sessionManager.endAllSessions();
      mockPasskeyService.authenticate.mockClear();

      // First call requires auth
      const key = await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
      expect(key).toBe(TEST_KEYS.openai);
    });

    it('starts session after first auth', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      manager.sessionManager.endAllSessions();
      await manager.retrieveKey('openai');

      expectSessionActive(manager.sessionManager, 'openai');
    });
  });

  describe('Subsequent Use Flow', () => {
    it('does not require passkey auth when session active', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      // Session started by storeKey
      mockPasskeyService.authenticate.mockClear();

      // Second call uses session
      const key = await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).not.toHaveBeenCalled();
      expect(key).toBe(TEST_KEYS.openai);
    });

    it('extends session on each use', async () => {
      const extendedCallback = vi.fn();
      manager.on('sessionExtended', extendedCallback);

      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      extendedCallback.mockClear();
      await manager.retrieveKey('openai');

      expectEvent(extendedCallback, {
        provider: 'openai',
        duration: expect.any(Number)
      });
    });
  });

  describe('Session Expiry Flow', () => {
    it('requires passkey auth after session expires', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      // Fast forward past expiry
      advanceTime(DURATIONS.sessionExpiry);

      mockPasskeyService.authenticate.mockClear();
      await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
    });

    it('emits sessionExpired event', async () => {
      const expiredCallback = vi.fn();
      manager.on('sessionExpired', expiredCallback);

      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      advanceTime(DURATIONS.sessionExpiry);

      expectEvent(expiredCallback, { provider: 'openai' });
    });
  });

  describe('Manual Lock Flow', () => {
    it('clears session when locked', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      expectSessionActive(manager.sessionManager, 'openai');

      manager.lockSession('openai');

      expectSessionInactive(manager.sessionManager, 'openai');
    });

    it('requires passkey auth after manual lock', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      manager.lockSession('openai');
      mockPasskeyService.authenticate.mockClear();

      await manager.retrieveKey('openai');

      expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
    });

    it('locks all sessions', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      await manager.createPasskey('anthropic');
      await manager.storeKey('anthropic', TEST_KEYS.anthropic);

      manager.lockAllSessions();

      expectSessionInactive(manager.sessionManager, 'openai');
      expectSessionInactive(manager.sessionManager, 'anthropic');
    });
  });

  describe('Multi-Provider Sessions', () => {
    it('manages independent sessions per provider', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      await manager.createPasskey('anthropic');
      await manager.storeKey('anthropic', TEST_KEYS.anthropic);

      expectSessionActive(manager.sessionManager, 'openai');
      expectSessionActive(manager.sessionManager, 'anthropic');
    });

    it('retrieves correct key per provider', async () => {
      await manager.createPasskey('openai');
      await manager.storeKey('openai', TEST_KEYS.openai);

      await manager.createPasskey('anthropic');
      await manager.storeKey('anthropic', TEST_KEYS.anthropic);

      mockPasskeyService.authenticate.mockClear();

      expect(await manager.retrieveKey('openai')).toBe(TEST_KEYS.openai);
      expect(await manager.retrieveKey('anthropic')).toBe(TEST_KEYS.anthropic);
      expect(mockPasskeyService.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('Capability Detection', () => {
    it('emits capabilityDetected event on init', async () => {
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