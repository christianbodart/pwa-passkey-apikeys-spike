// tests/unit/errors.test.js
import { describe, it, expect } from 'vitest';
import {
  AppError,
  PasskeyError,
  StorageError,
  CryptoError,
  ProviderError,
  ValidationError,
  AuthenticationError
} from '../../src/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('extends Error', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
    });

    it('has correct name', () => {
      const error = new AppError('Test error');
      expect(error.name).toBe('AppError');
    });

    it('stores error code', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      expect(error.code).toBe('TEST_CODE');
    });

    it('has stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('PasskeyError', () => {
    it('extends AppError', () => {
      const error = new PasskeyError('Passkey failed');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    it('has correct name', () => {
      const error = new PasskeyError('Passkey failed');
      expect(error.name).toBe('PasskeyError');
    });

    it('uses default code', () => {
      const error = new PasskeyError('Passkey failed');
      expect(error.code).toBe('PASSKEY_ERROR');
    });

    it('accepts custom code', () => {
      const error = new PasskeyError('Passkey failed', 'CUSTOM_CODE');
      expect(error.code).toBe('CUSTOM_CODE');
    });
  });

  describe('AuthenticationError', () => {
    it('extends PasskeyError', () => {
      const error = new AuthenticationError('Auth failed');
      expect(error).toBeInstanceOf(PasskeyError);
      expect(error).toBeInstanceOf(AppError);
    });

    it('has correct code', () => {
      const error = new AuthenticationError('Auth failed');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('StorageError', () => {
    it('extends AppError', () => {
      const error = new StorageError('Storage failed');
      expect(error).toBeInstanceOf(AppError);
    });

    it('has correct name', () => {
      const error = new StorageError('Storage failed');
      expect(error.name).toBe('StorageError');
    });

    it('uses default code', () => {
      const error = new StorageError('Storage failed');
      expect(error.code).toBe('STORAGE_ERROR');
    });
  });

  describe('CryptoError', () => {
    it('extends AppError', () => {
      const error = new CryptoError('Crypto failed');
      expect(error).toBeInstanceOf(AppError);
    });

    it('has correct name', () => {
      const error = new CryptoError('Crypto failed');
      expect(error.name).toBe('CryptoError');
    });

    it('uses default code', () => {
      const error = new CryptoError('Crypto failed');
      expect(error.code).toBe('CRYPTO_ERROR');
    });
  });

  describe('ProviderError', () => {
    it('extends AppError', () => {
      const error = new ProviderError('Provider failed');
      expect(error).toBeInstanceOf(AppError);
    });

    it('has correct name', () => {
      const error = new ProviderError('Provider failed');
      expect(error.name).toBe('ProviderError');
    });
  });

  describe('ValidationError', () => {
    it('extends AppError', () => {
      const error = new ValidationError('Validation failed');
      expect(error).toBeInstanceOf(AppError);
    });

    it('has correct name', () => {
      const error = new ValidationError('Validation failed');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('Error Catching', () => {
    it('can catch by specific type', () => {
      try {
        throw new StorageError('DB failed');
      } catch (err) {
        if (err instanceof StorageError) {
          expect(err.message).toBe('DB failed');
        } else {
          throw new Error('Wrong error type caught');
        }
      }
    });

    it('can catch by base type', () => {
      try {
        throw new CryptoError('Encryption failed');
      } catch (err) {
        if (err instanceof AppError) {
          expect(err.code).toBe('CRYPTO_ERROR');
        } else {
          throw new Error('Not caught as AppError');
        }
      }
    });
  });
});
