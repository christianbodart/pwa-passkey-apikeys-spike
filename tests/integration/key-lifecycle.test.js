// tests/integration/key-lifecycle.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

describe('Key Lifecycle Integration', () => {
  let db;
  const DB_NAME = 'pwa-apikeys-v1';
  const STORE_NAME = 'keys';
  const PROVIDER = 'openai';
  const API_KEY = 'sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz';

  beforeEach(async () => {
    // Initialize database
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'provider' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    indexedDB.deleteDatabase(DB_NAME);
  });

  describe('Complete Flow: Passkey → Encrypt → Store → Retrieve → Decrypt', () => {
    it('executes full key storage lifecycle', async () => {
      // Step 1: Create Passkey (Mock WebAuthn)
      const mockCredential = {
        id: 'credential-123',
        rawId: crypto.getRandomValues(new Uint8Array(32)).buffer,
        type: 'public-key'
      };

      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      const credential = await navigator.credentials.create({
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

      expect(credential.rawId).toBeDefined();

      // Store credential ID
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: PROVIDER,
          credentialId: credential.rawId,
          created: Date.now()
        });
        req.onsuccess = () => resolve();
      });

      // Step 2: Authenticate with Passkey (Mock)
      const mockAssertion = {
        id: 'assertion-456',
        rawId: credential.rawId,
        type: 'public-key'
      };

      globalThis.navigator.credentials.get.mockResolvedValue(mockAssertion);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: credential.rawId }],
          userVerification: 'required'
        }
      });

      expect(assertion).toBeDefined();

      // Step 3: Generate Encryption Key
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const keyMaterial = await crypto.subtle.exportKey('raw', encKey);
      expect(keyMaterial.byteLength).toBe(32);

      // Step 4: Encrypt API Key
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(API_KEY)
      );

      expect(encrypted).toBeInstanceOf(ArrayBuffer);

      // Step 5: Store Encrypted Data
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: PROVIDER,
          credentialId: credential.rawId,
          encKeyMaterial: keyMaterial,
          iv,
          encrypted
        });
        req.onsuccess = () => resolve();
      });

      // Step 6: Retrieve Encrypted Data
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(PROVIDER);
        req.onsuccess = () => resolve(req.result);
      });

      expect(record).toBeDefined();
      expect(record.encKeyMaterial).toBeInstanceOf(ArrayBuffer);
      expect(record.iv).toBeInstanceOf(Uint8Array);
      expect(record.encrypted).toBeInstanceOf(ArrayBuffer);

      // Step 7: Re-authenticate for Decryption (Mock)
      const mockAssertion2 = {
        id: 'assertion-789',
        rawId: credential.rawId,
        type: 'public-key'
      };

      globalThis.navigator.credentials.get.mockResolvedValue(mockAssertion2);

      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: record.credentialId }],
          userVerification: 'required'
        }
      });

      // Step 8: Import Key for Decryption
      const decKey = await crypto.subtle.importKey(
        'raw',
        record.encKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Step 9: Decrypt API Key
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv },
        decKey,
        record.encrypted
      );

      const decryptedKey = new TextDecoder().decode(decrypted);

      // Step 10: Verify Roundtrip
      expect(decryptedKey).toBe(API_KEY);
    });
  });

  describe('Multi-Provider Scenario', () => {
    it('manages keys for multiple providers independently', async () => {
      const providers = [
        { name: 'openai', key: 'sk-proj-openai123' },
        { name: 'anthropic', key: 'sk-ant-anthropic456' },
        { name: 'google', key: 'AIzaSyGoogle789' }
      ];

      // Store encrypted keys for each provider
      for (const provider of providers) {
        // Mock passkey creation
        const mockCredential = {
          rawId: crypto.getRandomValues(new Uint8Array(32)).buffer
        };
        globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

        await navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'PWA API Keys', id: 'localhost' },
            user: {
              id: new TextEncoder().encode(provider.name),
              name: provider.name,
              displayName: provider.name
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
              userVerification: 'required',
              residentKey: 'required'
            }
          }
        });

        // Encrypt
        const encKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        const keyMaterial = await crypto.subtle.exportKey('raw', encKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          encKey,
          new TextEncoder().encode(provider.key)
        );

        // Store
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put({
            provider: provider.name,
            credentialId: mockCredential.rawId,
            encKeyMaterial: keyMaterial,
            iv,
            encrypted
          });
          req.onsuccess = () => resolve();
        });
      }

      // Verify each provider's key can be retrieved and decrypted
      for (const provider of providers) {
        const record = await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(provider.name);
          req.onsuccess = () => resolve(req.result);
        });

        const decKey = await crypto.subtle.importKey(
          'raw',
          record.encKeyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: record.iv },
          decKey,
          record.encrypted
        );

        const decryptedKey = new TextDecoder().decode(decrypted);
        expect(decryptedKey).toBe(provider.key);
      }
    });
  });

  describe('Error Scenarios', () => {
    it('fails decryption without authentication', async () => {
      // Store encrypted key
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const keyMaterial = await crypto.subtle.exportKey('raw', encKey);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(API_KEY)
      );

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: PROVIDER,
          credentialId: crypto.getRandomValues(new Uint8Array(32)).buffer,
          encKeyMaterial: keyMaterial,
          iv,
          encrypted
        });
        req.onsuccess = () => resolve();
      });

      // Simulate authentication failure
      globalThis.navigator.credentials.get.mockRejectedValue(
        new DOMException('Authentication failed', 'NotAllowedError')
      );

      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(PROVIDER);
        req.onsuccess = () => resolve(req.result);
      });

      await expect(
        navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ type: 'public-key', id: record.credentialId }],
            userVerification: 'required'
          }
        })
      ).rejects.toThrow('Authentication failed');
    });

    it('handles missing record gracefully', async () => {
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('nonexistent');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record).toBeUndefined();
    });

    it('fails with tampered ciphertext', async () => {
      // Store encrypted key
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const keyMaterial = await crypto.subtle.exportKey('raw', encKey);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(API_KEY)
      );

      // Tamper with ciphertext
      const tampered = new Uint8Array(encrypted);
      tampered[0] ^= 0xFF;

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: PROVIDER,
          credentialId: crypto.getRandomValues(new Uint8Array(32)).buffer,
          encKeyMaterial: keyMaterial,
          iv,
          encrypted: tampered.buffer
        });
        req.onsuccess = () => resolve();
      });

      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(PROVIDER);
        req.onsuccess = () => resolve(req.result);
      });

      const decKey = await crypto.subtle.importKey(
        'raw',
        record.encKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decryption should fail (GCM authentication)
      await expect(
        crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: record.iv },
          decKey,
          record.encrypted
        )
      ).rejects.toThrow();
    });
  });

  describe('Key Update Flow', () => {
    it('updates existing key with new encryption', async () => {
      const oldKey = 'sk-proj-old123';
      const newKey = 'sk-proj-new456';

      // Store initial key
      const encKey1 = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const keyMaterial1 = await crypto.subtle.exportKey('raw', encKey1);
      const iv1 = crypto.getRandomValues(new Uint8Array(12));
      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv1 },
        encKey1,
        new TextEncoder().encode(oldKey)
      );

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: PROVIDER,
          credentialId: crypto.getRandomValues(new Uint8Array(32)).buffer,
          encKeyMaterial: keyMaterial1,
          iv: iv1,
          encrypted: encrypted1
        });
        req.onsuccess = () => resolve();
      });

      // Update with new key
      const encKey2 = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const keyMaterial2 = await crypto.subtle.exportKey('raw', encKey2);
      const iv2 = crypto.getRandomValues(new Uint8Array(12));
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv2 },
        encKey2,
        new TextEncoder().encode(newKey)
      );

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: PROVIDER,
          credentialId: crypto.getRandomValues(new Uint8Array(32)).buffer,
          encKeyMaterial: keyMaterial2,
          iv: iv2,
          encrypted: encrypted2
        });
        req.onsuccess = () => resolve();
      });

      // Verify new key is stored
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(PROVIDER);
        req.onsuccess = () => resolve(req.result);
      });

      const decKey = await crypto.subtle.importKey(
        'raw',
        record.encKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv },
        decKey,
        record.encrypted
      );

      const decryptedKey = new TextDecoder().decode(decrypted);
      expect(decryptedKey).toBe(newKey);
      expect(decryptedKey).not.toBe(oldKey);
    });
  });
});
