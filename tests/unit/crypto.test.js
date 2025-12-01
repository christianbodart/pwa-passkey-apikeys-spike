// tests/unit/crypto.test.js
import { describe, it, expect, beforeEach } from 'vitest';

describe('Web Crypto API - AES-GCM Encryption', () => {
  describe('Key Generation', () => {
    it('generates AES-256 key', async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(key.algorithm.length).toBe(256);
    });

    it('allows key export when extractable is true', async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      const exported = await crypto.subtle.exportKey('raw', key);
      expect(exported).toBeInstanceOf(ArrayBuffer);
      expect(exported.byteLength).toBe(32); // 256 bits = 32 bytes
    });

    it('creates non-extractable key for security', async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt']
      );

      expect(key.extractable).toBe(false);
      
      // Should fail to export
      await expect(
        crypto.subtle.exportKey('raw', key)
      ).rejects.toThrow();
    });

    it('generates unique keys on each call', async () => {
      const key1 = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const key2 = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);

      // Keys should be different
      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });
  });

  describe('Key Import/Export', () => {
    let keyMaterial;

    beforeEach(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      keyMaterial = await crypto.subtle.exportKey('raw', key);
    });

    it('imports raw key material', async () => {
      const importedKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('secret');
      expect(importedKey.algorithm.name).toBe('AES-GCM');
    });

    it('imports with correct usage restrictions', async () => {
      const decryptOnlyKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'] // Only decrypt, not encrypt
      );

      expect(decryptOnlyKey.usages).toEqual(['decrypt']);
    });

    it('maintains 32-byte key material size', () => {
      expect(keyMaterial.byteLength).toBe(32);
    });
  });

  describe('Encryption', () => {
    let key;

    beforeEach(async () => {
      key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('encrypts plain text API key', async () => {
      const plaintext = 'sk-test1234567890abcdef';
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      );

      expect(ciphertext).toBeInstanceOf(ArrayBuffer);
      expect(ciphertext.byteLength).toBeGreaterThan(0);
      // Ciphertext should be different from plaintext
      expect(new Uint8Array(ciphertext)).not.toEqual(
        new TextEncoder().encode(plaintext)
      );
    });

    it('uses 12-byte IV for GCM mode', async () => {
      const plaintext = 'sk-test-api-key';
      const iv = crypto.getRandomValues(new Uint8Array(12));

      expect(iv.length).toBe(12);

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      );

      expect(ciphertext).toBeDefined();
    });

    it('produces different ciphertext with different IVs', async () => {
      const plaintext = 'sk-same-key';
      const iv1 = crypto.getRandomValues(new Uint8Array(12));
      const iv2 = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv1 },
        key,
        new TextEncoder().encode(plaintext)
      );

      const ciphertext2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv2 },
        key,
        new TextEncoder().encode(plaintext)
      );

      // Same plaintext + key but different IVs = different ciphertext
      expect(new Uint8Array(ciphertext1)).not.toEqual(new Uint8Array(ciphertext2));
    });

    it('handles empty strings', async () => {
      const plaintext = '';
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      );

      expect(ciphertext).toBeDefined();
      expect(ciphertext.byteLength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Decryption', () => {
    let key;
    let plaintext;
    let iv;
    let ciphertext;

    beforeEach(async () => {
      key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      plaintext = 'sk-proj-1234567890abcdefghijklmnop';
      iv = crypto.getRandomValues(new Uint8Array(12));

      ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      );
    });

    it('decrypts back to original plaintext', async () => {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      expect(decryptedText).toBe(plaintext);
    });

    it('requires correct IV for decryption', async () => {
      const wrongIV = crypto.getRandomValues(new Uint8Array(12));

      await expect(
        crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: wrongIV },
          key,
          ciphertext
        )
      ).rejects.toThrow();
    });

    it('requires correct key for decryption', async () => {
      const wrongKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      await expect(
        crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          wrongKey,
          ciphertext
        )
      ).rejects.toThrow();
    });

    it('detects tampered ciphertext', async () => {
      // Modify the ciphertext
      const tamperedCiphertext = new Uint8Array(ciphertext);
      tamperedCiphertext[0] ^= 0xFF; // Flip bits

      await expect(
        crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          tamperedCiphertext.buffer
        )
      ).rejects.toThrow();
    });
  });

  describe('Encrypt/Decrypt Roundtrip', () => {
    it('handles typical OpenAI API key', async () => {
      const apiKey = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop123456';
      
      // Generate key
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const keyMaterial = await crypto.subtle.exportKey('raw', encKey);

      // Encrypt
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(apiKey)
      );

      // Simulate storage (what goes to IndexedDB)
      expect(keyMaterial).toBeInstanceOf(ArrayBuffer);
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(encrypted).toBeInstanceOf(ArrayBuffer);

      // Import key for decryption (simulates retrieval)
      const decKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        decKey,
        encrypted
      );

      const decryptedKey = new TextDecoder().decode(decrypted);
      expect(decryptedKey).toBe(apiKey);
    });

    it('handles Anthropic API key format', async () => {
      const apiKey = 'sk-ant-api03-xyz123-abcdef';
      
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(apiKey)
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        encKey,
        encrypted
      );

      expect(new TextDecoder().decode(decrypted)).toBe(apiKey);
    });

    it('preserves special characters', async () => {
      const apiKey = 'test-key-with-special!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(apiKey)
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        encKey,
        encrypted
      );

      expect(new TextDecoder().decode(decrypted)).toBe(apiKey);
    });
  });

  describe('Random IV Generation', () => {
    it('generates cryptographically random IVs', () => {
      const iv1 = crypto.getRandomValues(new Uint8Array(12));
      const iv2 = crypto.getRandomValues(new Uint8Array(12));
      const iv3 = crypto.getRandomValues(new Uint8Array(12));

      // All IVs should be different
      expect(iv1).not.toEqual(iv2);
      expect(iv2).not.toEqual(iv3);
      expect(iv1).not.toEqual(iv3);
    });

    it('fills entire IV array', () => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Check no zeros (extremely unlikely if random)
      const hasNonZero = Array.from(iv).some(byte => byte !== 0);
      expect(hasNonZero).toBe(true);
    });
  });
});
