// tests/unit/session-manager.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionManager } from '../../src/session-manager.js';

describe('SessionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Session Lifecycle', () => {
    it('starts a new session', () => {
      manager.startSession('openai', 'sk-test-key', 1000);
      
      expect(manager.hasSession('openai')).toBe(true);
      expect(manager.getApiKey('openai')).toBe('sk-test-key');
    });

    it('ends a session', () => {
      manager.startSession('openai', 'sk-test-key', 1000);
      manager.endSession('openai');
      
      expect(manager.hasSession('openai')).toBe(false);
      expect(manager.getApiKey('openai')).toBeNull();
    });

    it('replaces existing session on restart', () => {
      manager.startSession('openai', 'sk-old-key', 1000);
      manager.startSession('openai', 'sk-new-key', 1000);
      
      expect(manager.getApiKey('openai')).toBe('sk-new-key');
    });

    it('auto-expires session after duration', () => {
      manager.startSession('openai', 'sk-test-key', 1000);
      
      expect(manager.hasSession('openai')).toBe(true);
      
      vi.advanceTimersByTime(1001);
      
      expect(manager.hasSession('openai')).toBe(false);
    });
  });

  describe('Multi-Provider Sessions', () => {
    it('manages multiple provider sessions independently', () => {
      manager.startSession('openai', 'sk-openai-key', 1000);
      manager.startSession('anthropic', 'sk-anthropic-key', 2000);
      
      expect(manager.hasSession('openai')).toBe(true);
      expect(manager.hasSession('anthropic')).toBe(true);
      expect(manager.getApiKey('openai')).toBe('sk-openai-key');
      expect(manager.getApiKey('anthropic')).toBe('sk-anthropic-key');
    });

    it('expires sessions independently', () => {
      manager.startSession('openai', 'sk-openai-key', 1000);
      manager.startSession('anthropic', 'sk-anthropic-key', 3000);
      
      vi.advanceTimersByTime(1500);
      
      expect(manager.hasSession('openai')).toBe(false);
      expect(manager.hasSession('anthropic')).toBe(true);
    });

    it('ends all sessions', () => {
      manager.startSession('openai', 'sk-openai-key', 1000);
      manager.startSession('anthropic', 'sk-anthropic-key', 1000);
      manager.startSession('google', 'sk-google-key', 1000);
      
      manager.endAllSessions();
      
      expect(manager.hasSession('openai')).toBe(false);
      expect(manager.hasSession('anthropic')).toBe(false);
      expect(manager.hasSession('google')).toBe(false);
    });
  });

  describe('Session Extension', () => {
    it('extends session timeout', () => {
      manager.startSession('openai', 'sk-test-key', 1000);
      
      vi.advanceTimersByTime(500);
      manager.extendSession('openai');
      
      vi.advanceTimersByTime(700);
      expect(manager.hasSession('openai')).toBe(true);
      
      vi.advanceTimersByTime(400);
      expect(manager.hasSession('openai')).toBe(false);
    });

    it('does nothing if no session exists', () => {
      manager.extendSession('nonexistent');
      expect(manager.hasSession('nonexistent')).toBe(false);
    });
  });

  describe('Session Info', () => {
    it('returns session info for active session', () => {
      manager.startSession('openai', 'sk-test-key', 5000);
      
      const info = manager.getSessionInfo('openai');
      
      expect(info).toBeDefined();
      expect(info.active).toBe(true);
      expect(info.duration).toBe(5000);
      expect(info.remaining).toBeGreaterThan(4900);
      expect(info.elapsed).toBeLessThan(100);
    });

    it('returns null for non-existent session', () => {
      expect(manager.getSessionInfo('nonexistent')).toBeNull();
    });

    it('updates elapsed and remaining time', () => {
      manager.startSession('openai', 'sk-test-key', 5000);
      
      vi.advanceTimersByTime(2000);
      
      const info = manager.getSessionInfo('openai');
      expect(info.elapsed).toBeGreaterThanOrEqual(2000);
      expect(info.remaining).toBeLessThanOrEqual(3000);
    });
  });

  describe('Active Sessions', () => {
    it('returns all active sessions', () => {
      manager.startSession('openai', 'sk-openai-key', 1000);
      manager.startSession('anthropic', 'sk-anthropic-key', 1000);
      
      const sessions = manager.getActiveSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.provider)).toContain('openai');
      expect(sessions.map(s => s.provider)).toContain('anthropic');
    });

    it('returns empty array when no sessions', () => {
      expect(manager.getActiveSessions()).toEqual([]);
    });
  });

  describe('Events', () => {
    it('emits started event', () => {
      const callback = vi.fn();
      manager.on('started', callback);
      
      manager.startSession('openai', 'sk-test-key', 1000);
      
      expect(callback).toHaveBeenCalledWith({
        provider: 'openai',
        duration: 1000
      });
    });

    it('emits expired event', () => {
      const callback = vi.fn();
      manager.on('expired', callback);
      
      manager.startSession('openai', 'sk-test-key', 1000);
      vi.advanceTimersByTime(1001);
      
      expect(callback).toHaveBeenCalledWith({ provider: 'openai' });
    });

    it('emits ended event', () => {
      const callback = vi.fn();
      manager.on('ended', callback);
      
      manager.startSession('openai', 'sk-test-key', 1000);
      manager.endSession('openai');
      
      expect(callback).toHaveBeenCalledWith({ provider: 'openai' });
    });

    it('emits extended event', () => {
      const callback = vi.fn();
      manager.on('extended', callback);
      
      manager.startSession('openai', 'sk-test-key', 1000);
      manager.extendSession('openai');
      
      expect(callback).toHaveBeenCalledWith({
        provider: 'openai',
        duration: 1000
      });
    });

    it('emits cleared event on endAllSessions', () => {
      const callback = vi.fn();
      manager.on('cleared', callback);
      
      manager.startSession('openai', 'sk-test-key', 1000);
      manager.endAllSessions();
      
      expect(callback).toHaveBeenCalledWith({});
    });
  });
});
