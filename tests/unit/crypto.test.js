import { describe, it, expect } from 'vitest';
import {
  generateTestKey,
  generateIV,
  encrypt,
  decrypt,
  encryptWithNewKey,
  decryptData,
  testRoundtrip,
  exportTestKey,
  importTestKey,
  testKeyPortability,
  getTestData
} from '../helpers/crypto-helpers.js';

describe('Web Crypto API - AES-GCM Encryption', () => {
  describe('Key Generation', () => {
    it('should generate an extractable AES-GCM key', async () => {
      const key = await generateTestKey(true);
      
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(key.extractable).toBe(true);
    });

    it('should generate a non-extractable key when specified', async () => {
      const key = await generateTestKey(false);
      
      expect(key.extractable).toBe(false);
    });
  });

  describe('IV Generation', () => {
    it('should generate a 12-byte IV', () => {
      const iv = generateIV();
      
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(12);
    });

    it('should generate unique IVs', () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      
      expect(iv1).not.toEqual(iv2);
    });
  });

  describe('Encryption and Decryption', () => {
    const testData = getTestData();

    it('should encrypt and decrypt simple text', async () => {
      const result = await testRoundtrip(testData.simple);
      
      expect(result.matches).toBe(true);
      expect(result.decrypted).toBe(testData.simple);
    });

    it('should handle empty strings', async () => {
      const result = await testRoundtrip(testData.empty);
      
      expect(result.matches).toBe(true);
    });

    it('should handle long strings', async () => {
      const result = await testRoundtrip(testData.long);
      
      expect(result.matches).toBe(true);
    });

    it('should handle special characters', async () => {
      const result = await testRoundtrip(testData.special);
      
      expect(result.matches).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const result = await testRoundtrip(testData.unicode);
      
      expect(result.matches).toBe(true);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const data1 = await encryptWithNewKey(testData.simple);
      const data2 = await encryptWithNewKey(testData.simple);
      
      expect(data1.encrypted).not.toEqual(data2.encrypted);
    });

    it('should fail decryption with wrong key', async () => {
      const { encrypted, iv } = await encryptWithNewKey(testData.simple);
      const wrongKey = await generateTestKey();
      
      await expect(decryptData(encrypted, iv, wrongKey)).rejects.toThrow();
    });

    it('should fail decryption with wrong IV', async () => {
      const { encrypted, key } = await encryptWithNewKey(testData.simple);
      const wrongIV = generateIV();
      
      await expect(decryptData(encrypted, wrongIV, key)).rejects.toThrow();
    });
  });

  describe('Key Export and Import', () => {
    it('should export key to JWK format', async () => {
      const key = await generateTestKey();
      const jwk = await exportTestKey(key);
      
      expect(jwk).toHaveProperty('kty', 'oct');
      expect(jwk).toHaveProperty('k');
      expect(jwk).toHaveProperty('alg', 'A256GCM');
    });

    it('should import key from JWK format', async () => {
      const originalKey = await generateTestKey();
      const jwk = await exportTestKey(originalKey);
      const importedKey = await importTestKey(jwk);
      
      expect(importedKey).toBeInstanceOf(CryptoKey);
      expect(importedKey.type).toBe('secret');
      expect(importedKey.algorithm.name).toBe('AES-GCM');
    });

    it('should maintain key functionality after export/import', async () => {
      const originalKey = await generateTestKey();
      const importedKey = await testKeyPortability(originalKey);
      
      const plaintext = testData.simple;
      const iv = generateIV();
      
      const encrypted = await encrypt(plaintext, originalKey, iv);
      const decrypted = await decrypt(encrypted, importedKey, iv);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to export non-extractable key', async () => {
      const key = await generateTestKey(false);
      
      await expect(exportTestKey(key)).rejects.toThrow();
    });
  });

  describe('Roundtrip Tests', () => {
    it('should handle typical OpenAI API key', async () => {
      const result = await testRoundtrip(getTestData().openai);
      
      expect(result.matches).toBe(true);
      expect(result.original).toBe(getTestData().openai);
    });

    it('should handle Anthropic API key format', async () => {
      const result = await testRoundtrip(getTestData().anthropic);
      
      expect(result.matches).toBe(true);
    });

    it('should preserve data integrity across encryption/decryption', async () => {
      const allTestData = getTestData();
      
      for (const [name, value] of Object.entries(allTestData)) {
        const result = await testRoundtrip(value);
        expect(result.matches).toBe(true, `Failed for ${name}`);
      }
    });
  });
});
