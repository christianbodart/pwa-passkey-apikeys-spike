// src/session-manager.js - Manages per-provider session timeouts
import { SecureCache } from './secure-cache.js';
import { SESSION_CONFIG } from './config.js';

/**
 * Manages in-memory sessions for decrypted API keys
 * Each provider gets its own secure cache with timeout
 */
export class SessionManager {
  constructor() {
    this.sessions = new Map(); // provider -> SecureCache
    this.listeners = new Map(); // event -> callbacks
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  /**
   * Start a session for a provider
   * @param {string} provider - Provider name
   * @param {string} apiKey - Decrypted API key
   * @param {number} duration - Session duration in ms
   */
  startSession(provider, apiKey, duration = SESSION_CONFIG.defaultDuration) {
    // Clear any existing session
    this.endSession(provider);
    
    // Create new secure cache
    const cache = new SecureCache();
    cache.store(apiKey, duration, () => {
      this.emit('expired', { provider });
      this.sessions.delete(provider);
    });
    
    this.sessions.set(provider, {
      cache,
      duration,
      startTime: Date.now()
    });
    
    this.emit('started', { provider, duration });
  }

  /**
   * Get API key from active session
   * @param {string} provider - Provider name
   * @returns {string|null}
   */
  getApiKey(provider) {
    const session = this.sessions.get(provider);
    if (!session) return null;
    
    return session.cache.retrieve();
  }

  /**
   * Check if provider has active session
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  hasSession(provider) {
    return this.sessions.has(provider);
  }

  /**
   * Extend session timeout (reset timer)
   * @param {string} provider - Provider name
   */
  extendSession(provider) {
    const session = this.sessions.get(provider);
    if (!session) return;
    
    session.cache.resetTimer(session.duration, () => {
      this.emit('expired', { provider });
      this.sessions.delete(provider);
    });
    
    // Update start time
    session.startTime = Date.now();
    
    this.emit('extended', { provider, duration: session.duration });
  }

  /**
   * End a session for a provider
   * @param {string} provider - Provider name
   */
  endSession(provider) {
    const session = this.sessions.get(provider);
    if (session) {
      session.cache.clear();
      this.sessions.delete(provider);
      this.emit('ended', { provider });
    }
  }

  /**
   * End all sessions
   */
  endAllSessions() {
    const providers = Array.from(this.sessions.keys());
    providers.forEach(provider => this.endSession(provider));
    this.emit('cleared', {});
  }

  /**
   * Get session info
   * @param {string} provider - Provider name
   * @returns {Object|null}
   */
  getSessionInfo(provider) {
    const session = this.sessions.get(provider);
    if (!session) return null;
    
    const elapsed = Date.now() - session.startTime;
    const remaining = Math.max(0, session.duration - elapsed);
    
    return {
      active: true,
      duration: session.duration,
      elapsed,
      remaining,
      expiresAt: session.startTime + session.duration
    };
  }

  /**
   * Get all active sessions
   * @returns {Array<{provider: string, info: Object}>}
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys()).map(provider => ({
      provider,
      info: this.getSessionInfo(provider)
    }));
  }
}
