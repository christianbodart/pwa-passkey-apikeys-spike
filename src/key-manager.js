// src/key-manager.js - Cryptographic operations for API key encryption
import { CryptoError } from './errors.js';
import { CRYPTO_CONFIG, WEBAUTHN_CONFIG } from './config.js';

export class KeyManager {
  /**
   * Generate a new AES encryption key
   * @param {boolean} extractable - Whether the key can be exported
   * @returns {Promise<CryptoKey>}
   */
  async generateEncryptionKey(extractable = true) {
    try {
      return await crypto.subtle.generateKey(
        { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.keyLength },
        extractable,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new CryptoError(
        `Failed to generate encryption key: ${error.message}`,
        'KEY_GENERATION_FAILED'
      );
    }
  }

  /**
   * Export a crypto key to raw format
   * @param {CryptoKey} key
   * @returns {Promise<ArrayBuffer>}
   */
  async exportKey(key) {
    try {
      return await crypto.subtle.exportKey('raw', key);
    } catch (error) {
      throw new CryptoError(
        `Failed to export key: ${error.message}`,
        'KEY_EXPORT_FAILED'
      );
    }
  }

  /**
   * Import a raw key buffer into a CryptoKey
   * @param {ArrayBuffer} keyBuffer
   * @param {boolean} extractable
   * @returns {Promise<CryptoKey>}
   */
  async importKey(keyBuffer, extractable = false) {
    try {
      return await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.keyLength },
        extractable,
        ['decrypt']
      );
    } catch (error) {
      throw new CryptoError(
        `Failed to import key: ${error.message}`,
        'KEY_IMPORT_FAILED'
      );
    }
  }

  /**
   * Encrypt an API key string
   * @param {string} apiKey - The plaintext API key
   * @param {CryptoKey} encryptionKey - The AES key to use
   * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array}>}
   */
  async encryptApiKey(apiKey, encryptionKey) {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength));
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);

      const encrypted = await crypto.subtle.encrypt(
        { name: CRYPTO_CONFIG.algorithm, iv },
        encryptionKey,
        data
      );

      return { encrypted, iv };
    } catch (error) {
      throw new CryptoError(
        `Encryption failed: ${error.message}`,
        'ENCRYPTION_FAILED'
      );
    }
  }

  /**
   * Decrypt an encrypted API key
   * @param {ArrayBuffer} encrypted - The encrypted data
   * @param {Uint8Array} iv - The initialization vector
   * @param {CryptoKey} decryptionKey - The AES key to use
   * @returns {Promise<string>}
   */
  async decryptApiKey(encrypted, iv, decryptionKey) {
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: CRYPTO_CONFIG.algorithm, iv },
        decryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new CryptoError(
        `Decryption failed: ${error.message}`,
        'DECRYPTION_FAILED'
      );
    }
  }

  /**
   * Generate a random challenge for WebAuthn
   * @param {number} length - Challenge length in bytes
   * @returns {Uint8Array}
   */
  generateChallenge(length = WEBAUTHN_CONFIG.challengeLength) {
    try {
      return crypto.getRandomValues(new Uint8Array(length));
    } catch (error) {
      throw new CryptoError(
        `Failed to generate challenge: ${error.message}`,
        'CHALLENGE_GENERATION_FAILED'
      );
    }
  }
}
