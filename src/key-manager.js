// src/key-manager.js - Cryptographic operations for API key encryption

// Constants
const AES_KEY_LENGTH = 256;
const AES_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

export class KeyManager {
  /**
   * Generate a new AES-256 encryption key
   * @param {boolean} extractable - Whether the key can be exported
   * @returns {Promise<CryptoKey>}
   */
  async generateEncryptionKey(extractable = true) {
    return crypto.subtle.generateKey(
      { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
      extractable,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export a crypto key to raw format
   * @param {CryptoKey} key
   * @returns {Promise<ArrayBuffer>}
   */
  async exportKey(key) {
    return crypto.subtle.exportKey('raw', key);
  }

  /**
   * Import a raw key buffer into a CryptoKey
   * @param {ArrayBuffer} keyBuffer
   * @param {boolean} extractable
   * @returns {Promise<CryptoKey>}
   */
  async importKey(keyBuffer, extractable = false) {
    return crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
      extractable,
      ['decrypt']
    );
  }

  /**
   * Encrypt an API key string
   * @param {string} apiKey - The plaintext API key
   * @param {CryptoKey} encryptionKey - The AES key to use
   * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array}>}
   */
  async encryptApiKey(apiKey, encryptionKey) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);

    const encrypted = await crypto.subtle.encrypt(
      { name: AES_ALGORITHM, iv },
      encryptionKey,
      data
    );

    return { encrypted, iv };
  }

  /**
   * Decrypt an encrypted API key
   * @param {ArrayBuffer} encrypted - The encrypted data
   * @param {Uint8Array} iv - The initialization vector
   * @param {CryptoKey} decryptionKey - The AES key to use
   * @returns {Promise<string>}
   */
  async decryptApiKey(encrypted, iv, decryptionKey) {
    const decrypted = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv },
      decryptionKey,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Generate a random challenge for WebAuthn
   * @param {number} length - Challenge length in bytes
   * @returns {Uint8Array}
   */
  generateChallenge(length = 32) {
    return crypto.getRandomValues(new Uint8Array(length));
  }
}
