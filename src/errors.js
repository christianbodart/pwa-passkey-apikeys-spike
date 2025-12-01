// src/errors.js - Custom error classes for better error handling

/**
 * Base error class for the application
 */
export class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * WebAuthn/Passkey related errors
 */
export class PasskeyError extends AppError {
  constructor(message, code = 'PASSKEY_ERROR') {
    super(message, code);
  }
}

/**
 * Storage/IndexedDB related errors
 */
export class StorageError extends AppError {
  constructor(message, code = 'STORAGE_ERROR') {
    super(message, code);
  }
}

/**
 * Cryptographic operation errors
 */
export class CryptoError extends AppError {
  constructor(message, code = 'CRYPTO_ERROR') {
    super(message, code);
  }
}

/**
 * API provider related errors
 */
export class ProviderError extends AppError {
  constructor(message, code = 'PROVIDER_ERROR') {
    super(message, code);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, code);
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends PasskeyError {
  constructor(message) {
    super(message, 'AUTHENTICATION_ERROR');
  }
}
