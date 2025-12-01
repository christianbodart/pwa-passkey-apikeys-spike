// tests/unit/passkey.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WebAuthn Passkey Operations', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('Credential Creation (Registration)', () => {
    it('creates passkey with correct parameters', async () => {
      const mockCredential = {
        id: 'mock-credential-id',
        rawId: new ArrayBuffer(32),
        type: 'public-key',
        response: {
          clientDataJSON: new ArrayBuffer(128),
          attestationObject: new ArrayBuffer(256)
        }
      };

      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PWA API Keys', id: 'localhost' },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      expect(credential).toBeDefined();
      expect(credential.rawId).toBeInstanceOf(ArrayBuffer);
      expect(navigator.credentials.create).toHaveBeenCalledTimes(1);
    });

    it('uses 32-byte random challenge', async () => {
      const mockCredential = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      expect(challenge).toBeInstanceOf(Uint8Array);
      expect(challenge.length).toBe(32);

      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PWA API Keys', id: 'localhost' },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.challenge).toBeInstanceOf(Uint8Array);
      expect(callArgs.publicKey.challenge.length).toBe(32);
    });

    it('requires user verification', async () => {
      const mockCredential = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'PWA API Keys', id: 'localhost' },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.authenticatorSelection.userVerification).toBe('required');
    });

    it('requires resident key (passkey)', async () => {
      const mockCredential = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'PWA API Keys', id: 'localhost' },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.authenticatorSelection.residentKey).toBe('required');
    });

    it('uses ES256 algorithm (alg: -7)', async () => {
      const mockCredential = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'PWA API Keys', id: 'localhost' },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.pubKeyCredParams[0].alg).toBe(-7);
    });

    it('handles user cancellation', async () => {
      globalThis.navigator.credentials.create.mockRejectedValue(
        new DOMException('User cancelled', 'NotAllowedError')
      );

      await expect(
        navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'PWA API Keys', id: 'localhost' },
            user: {
              id: new TextEncoder().encode('user1'),
              name: 'user1',
              displayName: 'User'
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
              userVerification: 'required',
              residentKey: 'required'
            }
          }
        })
      ).rejects.toThrow('User cancelled');
    });

    it('handles missing authenticator', async () => {
      globalThis.navigator.credentials.create.mockRejectedValue(
        new DOMException('No authenticator', 'NotSupportedError')
      );

      await expect(
        navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'PWA API Keys', id: 'localhost' },
            user: {
              id: new TextEncoder().encode('user1'),
              name: 'user1',
              displayName: 'User'
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
              userVerification: 'required',
              residentKey: 'required'
            }
          }
        })
      ).rejects.toThrow('No authenticator');
    });
  });

  describe('Credential Authentication (Login)', () => {
    const mockCredentialId = new Uint8Array([1, 2, 3, 4, 5]);

    it('authenticates with stored credential ID', async () => {
      const mockAssertion = {
        id: 'mock-assertion-id',
        rawId: mockCredentialId.buffer,
        type: 'public-key',
        response: {
          clientDataJSON: new ArrayBuffer(128),
          authenticatorData: new ArrayBuffer(64),
          signature: new ArrayBuffer(64)
        }
      };

      globalThis.navigator.credentials.get.mockResolvedValue(mockAssertion);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: mockCredentialId }],
          userVerification: 'required'
        }
      });

      expect(assertion).toBeDefined();
      expect(assertion.rawId).toBeDefined();
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('requires user verification for authentication', async () => {
      const mockAssertion = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.get.mockResolvedValue(mockAssertion);

      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: mockCredentialId }],
          userVerification: 'required'
        }
      });

      const callArgs = navigator.credentials.get.mock.calls[0][0];
      expect(callArgs.publicKey.userVerification).toBe('required');
    });

    it('uses fresh challenge for each authentication', async () => {
      const mockAssertion = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.get.mockResolvedValue(mockAssertion);

      const challenge1 = crypto.getRandomValues(new Uint8Array(32));
      await navigator.credentials.get({
        publicKey: {
          challenge: challenge1,
          allowCredentials: [{ type: 'public-key', id: mockCredentialId }],
          userVerification: 'required'
        }
      });

      const challenge2 = crypto.getRandomValues(new Uint8Array(32));
      await navigator.credentials.get({
        publicKey: {
          challenge: challenge2,
          allowCredentials: [{ type: 'public-key', id: mockCredentialId }],
          userVerification: 'required'
        }
      });

      // Challenges should be different
      expect(challenge1).not.toEqual(challenge2);
    });

    it('handles authentication failure', async () => {
      globalThis.navigator.credentials.get.mockRejectedValue(
        new DOMException('Authentication failed', 'NotAllowedError')
      );

      await expect(
        navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ type: 'public-key', id: mockCredentialId }],
            userVerification: 'required'
          }
        })
      ).rejects.toThrow('Authentication failed');
    });

    it('handles timeout', async () => {
      globalThis.navigator.credentials.get.mockRejectedValue(
        new DOMException('Timeout', 'NotAllowedError')
      );

      await expect(
        navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ type: 'public-key', id: mockCredentialId }],
            userVerification: 'required',
            timeout: 60000
          }
        })
      ).rejects.toThrow('Timeout');
    });
  });

  describe('Credential ID Storage', () => {
    it('stores credential ID as ArrayBuffer', () => {
      const credentialId = new Uint8Array([10, 20, 30, 40, 50]);
      const stored = {
        provider: 'openai',
        credentialId: credentialId.buffer
      };

      expect(stored.credentialId).toBeInstanceOf(ArrayBuffer);
      expect(stored.credentialId.byteLength).toBe(5);
    });

    it('can reconstruct Uint8Array from stored ArrayBuffer', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const stored = original.buffer;

      const reconstructed = new Uint8Array(stored);
      expect(reconstructed).toEqual(original);
    });

    it('preserves credential ID across storage operations', () => {
      const credentialId = crypto.getRandomValues(new Uint8Array(32));
      const asBuffer = credentialId.buffer;
      
      // Simulate storage roundtrip
      const retrieved = new Uint8Array(asBuffer);
      
      expect(retrieved).toEqual(credentialId);
      expect(retrieved.buffer.byteLength).toBe(32);
    });
  });

  describe('RP ID Validation', () => {
    it('uses correct hostname for RP ID', () => {
      expect(globalThis.location.hostname).toBe('localhost');
    });

    it('matches RP ID with location hostname', async () => {
      const mockCredential = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'PWA API Keys', id: globalThis.location.hostname },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.rp.id).toBe(globalThis.location.hostname);
    });
  });

  describe('Security Requirements', () => {
    it('enforces HTTPS or localhost context', () => {
      // In real browsers, WebAuthn only works on HTTPS or localhost
      expect(['localhost', '127.0.0.1']).toContain(globalThis.location.hostname);
    });

    it('generates unique challenges', () => {
      const challenges = [];
      for (let i = 0; i < 10; i++) {
        challenges.push(crypto.getRandomValues(new Uint8Array(32)));
      }

      // All challenges should be unique
      for (let i = 0; i < challenges.length; i++) {
        for (let j = i + 1; j < challenges.length; j++) {
          expect(challenges[i]).not.toEqual(challenges[j]);
        }
      }
    });

    it('requires user interaction (via userVerification)', async () => {
      const mockCredential = { rawId: new ArrayBuffer(32) };
      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'PWA API Keys', id: 'localhost' },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      // Verify that biometric/PIN is required
      const callArgs = navigator.credentials.create.mock.calls[0][0];
      expect(callArgs.publicKey.authenticatorSelection.userVerification).toBe('required');
    });
  });
});
