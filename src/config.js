// src/config.js - Application configuration

/**
 * WebAuthn configuration
 */
export const WEBAUTHN_CONFIG = {
  // Relying Party configuration
  rp: {
    name: 'PWA API Keys'
    // id is set dynamically to location.hostname
  },
  
  // User configuration (can be customized per user)
  user: {
    name: 'user1',
    displayName: 'User'
    // id is generated per provider
  },
  
  // Supported algorithms (in order of preference)
  algorithms: [
    { type: 'public-key', alg: -7 },   // ES256 (ECDSA with SHA-256)
    { type: 'public-key', alg: -257 }  // RS256 (RSA with SHA-256)
  ],
  
  // Authenticator selection criteria
  authenticatorSelection: {
    userVerification: 'required',
    residentKey: 'required',
    authenticatorAttachment: undefined // Allow both platform and cross-platform
  },
  
  // Challenge configuration
  challengeLength: 32, // bytes
  
  // Timeout configuration
  timeout: 60000 // 60 seconds
};

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  dbName: 'pwa-apikeys-v1',
  storeName: 'keys',
  version: 1
};

/**
 * Encryption configuration
 */
export const CRYPTO_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  tagLength: 128
};

/**
 * Application configuration
 */
export const APP_CONFIG = {
  // Maximum number of retry attempts
  maxRetries: 3,
  
  // Key expiration (in milliseconds, 0 = no expiration)
  keyExpiration: 0,
  
  // Enable debug logging
  debug: false
};
