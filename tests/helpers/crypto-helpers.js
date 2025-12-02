// tests/helpers/crypto-helpers.js
/**
 * Crypto operation helpers for testing AES-GCM encryption/decryption
 * Provides reusable functions with robust error handling and timeouts
 */

/**
 * Generate AES-GCM key with sensible defaults
 * @param {boolean} extractable - Whether key can be exported
 * @param {string[]} usages - Key usages (default: ['encrypt', 'decrypt'])
 * @returns {Promise<CryptoKey>}
 */
export async function generateTestKey(extractable = true, usages = ['encrypt', 'decrypt']) {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    usages
  );
}

/**
 * Generate random IV for AES-GCM (12 bytes)
 * @returns {Uint8Array}
 */
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Generate cryptographically random challenge
 * @param {number} length - Challenge length in bytes (default: 32)
 * @returns {Uint8Array}
 */
export function generateChallenge(length = 32) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Export key to raw ArrayBuffer format
 * @param {CryptoKey} key - Key to export
 * @returns {Promise<ArrayBuffer>}
 */
export async function exportKey(key) {
  return await crypto.subtle.exportKey('raw', key);
}

/**
 * Import raw key material as CryptoKey
 * @param {ArrayBuffer} keyMaterial - Raw key bytes
 * @param {boolean} extractable - Whether imported key can be exported
 * @param {string[]} usages - Key usages
 * @returns {Promise<CryptoKey>}
 */
export async function importKey(keyMaterial, extractable = false, usages = ['decrypt']) {
  return await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    extractable,
    usages
  );
}

/**
 * Encrypt plaintext with AES-GCM
 * @param {string} plaintext - Text to encrypt
 * @param {CryptoKey} key - Encryption key
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<ArrayBuffer>}
 */
export async function encrypt(plaintext, key, iv) {
  const encoded = new TextEncoder().encode(plaintext);
  return await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
}

/**
 * Decrypt ciphertext with AES-GCM
 * @param {ArrayBuffer} ciphertext - Encrypted data
 * @param {CryptoKey} key - Decryption key
 * @param {Uint8Array} iv - Initialization vector used for encryption
 * @returns {Promise<string>}
 */
export async function decrypt(ciphertext, key, iv) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a new key and export its material
 * @param {boolean} extractable - Whether generated key can be exported
 * @returns {Promise<{key: CryptoKey, material: ArrayBuffer}>}
 */
export async function generateKeyMaterial(extractable = true) {
  const key = await generateTestKey(extractable);
  const material = await exportKey(key);
  return { key, material };
}

/**
 * Encrypt with a new key and IV (full operation)
 * @param {string} plaintext - Text to encrypt
 * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array, key: CryptoKey, keyMaterial: ArrayBuffer}>}
 */
export async function encryptWithNewKey(plaintext) {
  const key = await generateTestKey(true);
  const keyMaterial = await exportKey(key);
  const iv = generateIV();
  const encrypted = await encrypt(plaintext, key, iv);
  
  return { encrypted, iv, key, keyMaterial };
}

/**
 * Decrypt data (convenience wrapper)
 * @param {ArrayBuffer} encrypted - Ciphertext
 * @param {Uint8Array} iv - IV used during encryption
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<string>}
 */
export async function decryptData(encrypted, iv, key) {
  return await decrypt(encrypted, key, iv);
}

/**
 * Test complete encrypt/decrypt roundtrip
 * @param {string} apiKey - API key to test
 * @returns {Promise<{original: string, decrypted: string, encrypted: ArrayBuffer, iv: Uint8Array}>}
 */
export async function testRoundtrip(apiKey) {
  // Encrypt
  const { encrypted, iv, keyMaterial } = await encryptWithNewKey(apiKey);
  
  // Import key for decryption (simulates storage retrieval)
  const decKey = await importKey(keyMaterial, false, ['decrypt']);
  
  // Decrypt
  const decrypted = await decrypt(encrypted, decKey, iv);
  
  return {
    original: apiKey,
    decrypted,
    encrypted,
    iv
  };
}

/**
 * Create test encryption data (for storage tests)
 * @param {string} apiKey - API key to encrypt
 * @returns {Promise<{encKeyMaterial: ArrayBuffer, iv: Uint8Array, encrypted: ArrayBuffer}>}
 */
export async function createTestEncryptionData(apiKey) {
  const { encrypted, iv, keyMaterial } = await encryptWithNewKey(apiKey);
  return {
    encKeyMaterial: keyMaterial,
    iv,
    encrypted
  };
}

/**
 * Verify two ArrayBuffers are equal
 * @param {ArrayBuffer} buf1
 * @param {ArrayBuffer} buf2
 * @returns {boolean}
 */
export function arraysEqual(buf1, buf2) {
  const arr1 = new Uint8Array(buf1);
  const arr2 = new Uint8Array(buf2);
  
  if (arr1.length !== arr2.length) return false;
  
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  
  return true;
}
