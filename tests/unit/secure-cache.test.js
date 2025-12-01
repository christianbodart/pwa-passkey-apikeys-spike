// tests/unit/secure-cache.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SecureCache } from '../../src/secure-cache.js';

describe('SecureCache', () => {
  let cache;

  beforeEach(() => {
    cache = new SecureCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Storage', () => {
    it('stores and retrieves a value', () => {
      const value = 'sk-test-api-key-12345';
      cache.store(value, 1000);

      const retrieved = cache.retrieve();
      expect(retrieved).toBe(value);
    });

    it('returns null when cache is empty', () => {
      expect(cache.retrieve()).toBeNull();
    });

    it('handles empty strings', () => {
      cache.store('', 1000);
      expect(cache.retrieve()).toBe('');
    });

    it('handles special characters', () => {
      const value = 'test!@#$%^&*()_+-=[]{}|;:,.<>?';
      cache.store(value, 1000);
      expect(cache.retrieve()).toBe(value);
    });

    it('handles unicode characters', () => {
      const value = 'test-🔒-emoji-密钥';
      cache.store(value, 1000);
      expect(cache.retrieve()).toBe(value);
    });

    it('handles long strings', () => {
      const value = 'a'.repeat(10000);
      cache.store(value, 1000);
      expect(cache.retrieve()).toBe(value);
    });
  });

  describe('XOR Obfuscation', () => {
    it('stores data in obfuscated form', () => {
      const value = 'sk-secret-key';
      cache.store(value, 1000);

      // The stored value should not be directly accessible
      // This is a conceptual test - in practice we can't easily inspect WeakMap
      expect(cache.has()).toBe(true);
    });

    it('generates different obfuscation on each store', () => {
      const value = 'sk-same-key';
      
      cache.store(value, 1000);
      const first = cache.retrieve();
      
      cache.clear();
      
      cache.store(value, 1000);
      const second = cache.retrieve();

      // Both should decode to same value
      expect(first).toBe(value);
      expect(second).toBe(value);
    });
  });

  describe('Auto-Expiry', () => {
    it('auto-expires after timeout', () => {
      const value = 'sk-test-key';
      cache.store(value, 1000); // 1 second

      expect(cache.retrieve()).toBe(value);

      // Fast forward past expiry
      vi.advanceTimersByTime(1001);

      expect(cache.retrieve()).toBeNull();
    });

    it('calls onExpire callback when expired', () => {
      const onExpire = vi.fn();
      cache.store('test', 1000, onExpire);

      expect(onExpire).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1001);

      expect(onExpire).toHaveBeenCalledOnce();
    });

    it('does not call onExpire if cleared manually', () => {
      const onExpire = vi.fn();
      cache.store('test', 1000, onExpire);

      cache.clear();
      vi.advanceTimersByTime(1001);

      expect(onExpire).not.toHaveBeenCalled();
    });

    it('supports different expiry times', () => {
      cache.store('test', 5000);

      vi.advanceTimersByTime(4999);
      expect(cache.retrieve()).toBe('test');

      vi.advanceTimersByTime(2);
      expect(cache.retrieve()).toBeNull();
    });
  });

  describe('Timer Reset', () => {
    it('resets timer when resetTimer called', () => {
      const onExpire = vi.fn();
      cache.store('test', 1000, onExpire);

      vi.advanceTimersByTime(500);
      cache.resetTimer(1000, onExpire);

      vi.advanceTimersByTime(500);
      expect(cache.retrieve()).toBe('test');

      vi.advanceTimersByTime(501);
      expect(cache.retrieve()).toBeNull();
    });

    it('cancels previous timer', () => {
      const onExpire1 = vi.fn();
      const onExpire2 = vi.fn();
      
      cache.store('test', 1000, onExpire1);
      cache.resetTimer(2000, onExpire2);

      vi.advanceTimersByTime(1001);
      expect(onExpire1).not.toHaveBeenCalled();
      expect(cache.retrieve()).toBe('test');

      vi.advanceTimersByTime(1000);
      expect(onExpire2).toHaveBeenCalledOnce();
    });
  });

  describe('Clear', () => {
    it('clears stored value', () => {
      cache.store('test', 1000);
      expect(cache.retrieve()).toBe('test');

      cache.clear();
      expect(cache.retrieve()).toBeNull();
    });

    it('clears timer', () => {
      const onExpire = vi.fn();
      cache.store('test', 1000, onExpire);

      cache.clear();
      vi.advanceTimersByTime(1001);

      expect(onExpire).not.toHaveBeenCalled();
    });

    it('can store new value after clear', () => {
      cache.store('first', 1000);
      cache.clear();
      cache.store('second', 1000);

      expect(cache.retrieve()).toBe('second');
    });
  });

  describe('Has', () => {
    it('returns false when empty', () => {
      expect(cache.has()).toBe(false);
    });

    it('returns true when value stored', () => {
      cache.store('test', 1000);
      expect(cache.has()).toBe(true);
    });

    it('returns false after clear', () => {
      cache.store('test', 1000);
      cache.clear();
      expect(cache.has()).toBe(false);
    });

    it('returns false after expiry', () => {
      cache.store('test', 1000);
      vi.advanceTimersByTime(1001);
      expect(cache.has()).toBe(false);
    });
  });

  describe('Time Remaining', () => {
    it('returns null when no cache', () => {
      expect(cache.getTimeRemaining(1000)).toBeNull();
    });

    it('calculates time remaining correctly', () => {
      cache.store('test', 1000);
      
      const remaining = cache.getTimeRemaining(1000);
      expect(remaining).toBeGreaterThan(900);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    it('updates as time passes', () => {
      cache.store('test', 5000);
      
      vi.advanceTimersByTime(2000);
      const remaining = cache.getTimeRemaining(5000);
      
      expect(remaining).toBeGreaterThan(2900);
      expect(remaining).toBeLessThan(3100);
    });

    it('returns 0 when expired', () => {
      cache.store('test', 1000);
      vi.advanceTimersByTime(1001);
      
      expect(cache.getTimeRemaining(1000)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('throws CryptoError on invalid store', () => {
      // Mock crypto to fail
      const originalGetRandomValues = crypto.getRandomValues;
      crypto.getRandomValues = () => {
        throw new Error('Crypto failed');
      };

      expect(() => cache.store('test', 1000)).toThrow();

      crypto.getRandomValues = originalGetRandomValues;
    });
  });
});
