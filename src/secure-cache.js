// src/secure-cache.js - Obfuscated in-memory cache with auto-expiry
import { CryptoError } from './errors.js';

// Random symbol for property hiding
const CACHE_SYMBOL = Symbol(crypto.randomUUID().slice(0, 8));

// WeakMap for additional obfuscation
const cache = new WeakMap();
const cacheKey = Object.freeze({});

/**
 * Secure in-memory cache with XOR obfuscation
 * Keys are never stored in plaintext, even in memory
 */
export class SecureCache {
  constructor() {
    this[CACHE_SYMBOL] = {
      timer: null,
      created: null
    };
    // FIX: Clear any previous WeakMap reference
    cache.delete(cacheKey);
  }

  /**
   * Store a value with XOR obfuscation
   * @param {string} value - Value to store
   * @param {number} expiryMs - Expiry time in milliseconds
   * @param {Function} onExpire - Callback when cache expires
   * @returns {void}
   */
  store(value, expiryMs = 15 * 60 * 1000, onExpire = null) {
    try {
      // Clear existing first
      cache.delete(cacheKey);
      
      // XOR encode the value
      const encoder = new TextEncoder();
      const bytes = encoder.encode(value);
      const pad = crypto.getRandomValues(new Uint8Array(bytes.length));
      const data = new Uint8Array(bytes.length);
      
      for (let i = 0; i < bytes.length; i++) {
        data[i] = bytes[i] ^ pad[i];
      }
      
      // Store in WeakMap (non-enumerable)
      cache.set(cacheKey, { pad, data });
      
      // Set up auto-expiry
      this[CACHE_SYMBOL].created = Date.now();
      this.resetTimer(expiryMs, onExpire);
    } catch (error) {
      throw new CryptoError(
        `Failed to store in cache: ${error.message}`,
        'CACHE_STORE_FAILED'
      );
    }
  }

  /**
   * Retrieve and decode the cached value
   * @returns {string|null}
   */
  retrieve() {
    // FIX: Check if timer expired
    if (!this[CACHE_SYMBOL]?.timer) return null;
    
    try {
      const cached = cache.get(cacheKey);
      if (!cached) return null;
      
      const { pad, data } = cached;
      const decoded = new Uint8Array(data.length);
      
      for (let i = 0; i < data.length; i++) {
        decoded[i] = data[i] ^ pad[i];
      }
      
      return new TextDecoder().decode(decoded);
    } catch (error) {
      throw new CryptoError(
        `Failed to retrieve from cache: ${error.message}`,
        'CACHE_RETRIEVE_FAILED'
      );
    }
  }

  /**
   * Check if cache has a value
   * @returns {boolean}
   */
  has() {
    return cache.has(cacheKey);
  }

  /**
   * Clear the cache
   * @returns {void}
   */
  clear() {
    // Securely overwrite data before clearing
    const cached = cache.get(cacheKey);
    if (cached) {
      // Overwrite with random data
      crypto.getRandomValues(cached.pad);
      crypto.getRandomValues(cached.data);
    }
    
    cache.delete(cacheKey);
    
    if (this[CACHE_SYMBOL]?.timer) {
      clearTimeout(this[CACHE_SYMBOL].timer);
      this[CACHE_SYMBOL].timer = null;
    }
    
    this[CACHE_SYMBOL].created = null;
  }

  /**
   * Reset the expiry timer
   * @param {number} expiryMs - Expiry time in milliseconds
   * @param {Function} onExpire - Callback when cache expires
   * @returns {void}
   */
  resetTimer(expiryMs = 15 * 60 * 1000, onExpire = null) {
    if (this[CACHE_SYMBOL]?.timer) {
      clearTimeout(this[CACHE_SYMBOL].timer);
    }
    
    this[CACHE_SYMBOL].timer = setTimeout(() => {
      this.clear();
      if (onExpire) onExpire();
    }, expiryMs);
  }

  /**
   * Get time until expiry
   * @param {number} totalDuration - Total duration in ms
   * @returns {number} - Milliseconds remaining, 0 if expired/no cache
   */
  getTimeRemaining(totalDuration) {
    if (!this[CACHE_SYMBOL]?.created) return 0;
    
    const elapsed = Date.now() - this[CACHE_SYMBOL].created;
    const remaining = totalDuration - elapsed;
    
    return Math.max(0, remaining);
  }
}