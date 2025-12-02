import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateChallenge,
  generateCredentialId,
  createCredentialOptions,
  getAssertionOptions,
  createMockCredential,
  createMockAssertion,
  setupPasskeyMocks,
  createTestCredential,
  getTestAssertion,
  DEFAULT_CONFIG
} from '../helpers/passkey-helpers.js';

describe('WebAuthn Passkey Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPasskeyMocks(vi);
  });

  describe('Challenge Generation', () => {
    it('should generate a 32-byte random challenge', () => {
      const challenge = generateChallenge();
      
      expect(challenge).toBeInstanceOf(Uint8Array);
      expect(challenge.length).toBe(32);
    });

    it('should generate unique challenges', () => {
      const challenge1 = generateChallenge();
      const challenge2 = generateChallenge();
      
      expect(challenge1).not.toEqual(challenge2);
    });

    it('should generate challenges of custom length', () => {
      const challenge = generateChallenge(64);
      
      expect(challenge.length).toBe(64);
    });
  });

  describe('Credential Creation Options', () => {
    it('should create default credential options', () => {
      const options = createCredentialOptions();
      
      expect(options.publicKey).toBeDefined();
      expect(options.publicKey.challenge).toBeInstanceOf(Uint8Array);
      expect(options.publicKey.challenge.length).toBe(32);
      expect(options.publicKey.rp.name).toBe(DEFAULT_CONFIG.rpName);
      expect(options.publicKey.authenticatorSelection.userVerification).toBe('required');
      expect(options.publicKey.authenticatorSelection.residentKey).toBe('required');
    });

    it('should merge custom options', () => {
      const customChallenge = generateChallenge(16);
      const options = createCredentialOptions({
        challenge: customChallenge,
        rpName: 'Custom App'
      });
      
      expect(options.publicKey.challenge).toBe(customChallenge);
      expect(options.publicKey.rp.name).toBe('Custom App');
    });

    it('should include both ES256 and RS256 algorithms', () => {
      const options = createCredentialOptions();
      
      const algorithms = options.publicKey.pubKeyCredParams.map(p => p.alg);
      expect(algorithms).toContain(-7);   // ES256
      expect(algorithms).toContain(-257); // RS256
    });
  });

  describe('Assertion Options', () => {
    it('should create assertion options with credential ID', () => {
      const credentialId = new Uint8Array([1, 2, 3, 4, 5]);
      const options = getAssertionOptions(credentialId);
      
      expect(options.publicKey).toBeDefined();
      expect(options.publicKey.challenge).toBeInstanceOf(Uint8Array);
      expect(options.publicKey.allowCredentials).toHaveLength(1);
      expect(options.publicKey.allowCredentials[0].id).toBe(credentialId);
      expect(options.publicKey.userVerification).toBe('required');
    });

    it('should merge custom assertion options', () => {
      const credentialId = new Uint8Array([1, 2, 3]);
      const customTimeout = 30000;
      const options = getAssertionOptions(credentialId, {
        timeout: customTimeout
      });
      
      expect(options.publicKey.timeout).toBe(customTimeout);
    });
  });

  describe('Mock Credential Creation', () => {
    it('should create valid mock credential', () => {
      const mock = createMockCredential();
      
      expect(mock.id).toBeDefined();
      expect(mock.type).toBe('public-key');
      expect(mock.rawId).toBeInstanceOf(ArrayBuffer);
      expect(mock.response.clientDataJSON).toBeInstanceOf(ArrayBuffer);
      expect(mock.response.attestationObject).toBeInstanceOf(ArrayBuffer);
    });

    it('should create mock with custom credential ID', () => {
      const customId = crypto.getRandomValues(new Uint8Array(16));
      const mock = createMockCredential({ credentialId: customId });
      
      expect(new Uint8Array(mock.rawId)).toEqual(customId);
    });
  });

  describe('Mock Assertion Creation', () => {
    it('should create valid mock assertion', () => {
      const credentialId = new Uint8Array([1, 2, 3, 4, 5]);
      const mock = createMockAssertion(credentialId);
      
      expect(mock.type).toBe('public-key');
      expect(new Uint8Array(mock.rawId)).toEqual(credentialId);
      expect(mock.response.authenticatorData).toBeInstanceOf(ArrayBuffer);
      expect(mock.response.signature).toBeInstanceOf(ArrayBuffer);
    });

    it('should include userHandle in response', () => {
      const credentialId = new Uint8Array([1, 2, 3]);
      const mock = createMockAssertion(credentialId);
      
      expect(mock.response.userHandle).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('WebAuthn API Mocking', () => {
    it('should mock credentials.create', async () => {
      const credential = await createTestCredential();
      
      expect(credential).toBeDefined();
      expect(credential.type).toBe('public-key');
      expect(navigator.credentials.create).toHaveBeenCalledTimes(1);
    });

    it('should mock credentials.get', async () => {
      const credentialId = new Uint8Array([1, 2, 3, 4, 5]);
      const assertion = await getTestAssertion(credentialId);
      
      expect(assertion).toBeDefined();
      expect(assertion.type).toBe('public-key');
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('should pass custom options to create', async () => {
      const customChallenge = generateChallenge();
      await createTestCredential({ challenge: customChallenge });
      
      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.challenge).toBe(customChallenge);
    });

    it('should pass credential ID to get', async () => {
      const credentialId = new Uint8Array([5, 4, 3, 2, 1]);
      await getTestAssertion(credentialId);
      
      const callArgs = navigator.credentials.get.mock.calls[0][0];
      const allowedId = callArgs.publicKey.allowCredentials[0].id;
      expect(new Uint8Array(allowedId)).toEqual(credentialId);
    });
  });

  describe('Error Handling', () => {
    it('should handle user cancellation', async () => {
      globalThis.navigator.credentials.create.mockRejectedValue(
        new DOMException('User cancelled', 'NotAllowedError')
      );
      
      await expect(createTestCredential()).rejects.toThrow('User cancelled');
    });

    it('should handle missing authenticator', async () => {
      globalThis.navigator.credentials.create.mockRejectedValue(
        new DOMException('No authenticator', 'NotSupportedError')
      );
      
      await expect(createTestCredential()).rejects.toThrow('No authenticator');
    });

    it('should handle authentication failure', async () => {
      globalThis.navigator.credentials.get.mockRejectedValue(
        new DOMException('Auth failed', 'NotAllowedError')
      );
      
      const credentialId = new Uint8Array([1, 2, 3]);
      await expect(getTestAssertion(credentialId)).rejects.toThrow('Auth failed');
    });
  });

  describe('Security Requirements', () => {
    it('should require user verification in creation', () => {
      const options = createCredentialOptions();
      
      expect(options.publicKey.authenticatorSelection.userVerification).toBe('required');
    });

    it('should require resident key', () => {
      const options = createCredentialOptions();
      
      expect(options.publicKey.authenticatorSelection.residentKey).toBe('required');
      expect(options.publicKey.authenticatorSelection.requireResidentKey).toBe(true);
    });

    it('should require user verification in assertion', () => {
      const credentialId = new Uint8Array([1, 2, 3]);
      const options = getAssertionOptions(credentialId);
      
      expect(options.publicKey.userVerification).toBe('required');
    });

    it('should use cryptographically secure random for challenges', () => {
      const challenges = new Set();
      
      for (let i = 0; i < 100; i++) {
        const challenge = generateChallenge();
        const hex = Array.from(challenge).map(b => b.toString(16).padStart(2, '0')).join('');
        challenges.add(hex);
      }
      
      // All 100 challenges should be unique
      expect(challenges.size).toBe(100);
    });
  });
});
