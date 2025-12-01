// tests/unit/passkey-service.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasskeyService } from '../../src/passkey-service.js';
import { PasskeyError, AuthenticationError } from '../../src/errors.js';

describe('PasskeyService', () => {
  let service;

  beforeEach(() => {
    service = new PasskeyService();
  });

  describe('Support Detection', () => {
    it('detects WebAuthn support', () => {
      expect(service.isSupported()).toBe(true);
    });

    it('checks conditional mediation availability', async () => {
      const result = await service.isConditionalMediationAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error Mapping', () => {
    it('maps NotAllowedError to AuthenticationError', async () => {
      const mockNavigator = {
        credentials: {
          create: vi.fn().mockRejectedValue(
            Object.assign(new Error('User cancelled'), { name: 'NotAllowedError' })
          )
        }
      };
      
      global.navigator = mockNavigator;
      
      await expect(
        service.createCredential('test', new Uint8Array(32))
      ).rejects.toThrow(AuthenticationError);
    });

    it('maps InvalidStateError to PasskeyError', async () => {
      const mockNavigator = {
        credentials: {
          create: vi.fn().mockRejectedValue(
            Object.assign(new Error('Invalid state'), { name: 'InvalidStateError' })
          )
        }
      };
      
      global.navigator = mockNavigator;
      
      await expect(
        service.createCredential('test', new Uint8Array(32))
      ).rejects.toThrow(PasskeyError);
    });

    it('wraps unknown errors', async () => {
      const mockNavigator = {
        credentials: {
          create: vi.fn().mockRejectedValue(new Error('Unknown error'))
        }
      };
      
      global.navigator = mockNavigator;
      
      await expect(
        service.createCredential('test', new Uint8Array(32))
      ).rejects.toThrow(PasskeyError);
    });
  });

  describe('Credential Creation', () => {
    it('throws when WebAuthn not supported', async () => {
      const originalWindow = global.window;
      global.window = {};
      
      await expect(
        service.createCredential('test', new Uint8Array(32))
      ).rejects.toThrow('WebAuthn is not supported');
      
      global.window = originalWindow;
    });
  });

  describe('Authentication', () => {
    it('throws when credential ID missing', async () => {
      await expect(
        service.authenticate(null, new Uint8Array(32))
      ).rejects.toThrow('Credential ID is required');
    });

    it('throws when WebAuthn not supported', async () => {
      const originalWindow = global.window;
      global.window = {};
      
      await expect(
        service.authenticate(new ArrayBuffer(32), new Uint8Array(32))
      ).rejects.toThrow('WebAuthn is not supported');
      
      global.window = originalWindow;
    });
  });
});
