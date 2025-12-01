// src/capability-detector.js - Progressive enhancement capability detection

/**
 * Detects browser security capabilities for BYOK features
 */
export class CapabilityDetector {
  /**
   * Detect all security-related capabilities
   * @returns {Object} Capability flags
   */
  detect() {
    return {
      webauthn: this.hasWebAuthn(),
      subtleCrypto: this.hasSubtleCrypto(),
      visibilityApi: this.hasVisibilityApi(),
      indexedDB: this.hasIndexedDB(),
      timestamp: Date.now()
    };
  }

  /**
   * Check for WebAuthn support
   * @returns {boolean}
   */
  hasWebAuthn() {
    return (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Check for Web Crypto API support
   * @returns {boolean}
   */
  hasSubtleCrypto() {
    return (
      typeof window !== 'undefined' &&
      window.crypto !== undefined &&
      window.crypto.subtle !== undefined
    );
  }

  /**
   * Check for Page Visibility API support
   * @returns {boolean}
   */
  hasVisibilityApi() {
    return (
      typeof document !== 'undefined' &&
      typeof document.visibilityState !== 'undefined'
    );
  }

  /**
   * Check for IndexedDB support
   * @returns {boolean}
   */
  hasIndexedDB() {
    return (
      typeof window !== 'undefined' &&
      window.indexedDB !== undefined
    );
  }

  /**
   * Check for conditional mediation support (async)
   * @returns {Promise<boolean>}
   */
  async hasConditionalMediation() {
    if (!this.hasWebAuthn()) return false;
    
    try {
      if (window.PublicKeyCredential.isConditionalMediationAvailable) {
        return await window.PublicKeyCredential.isConditionalMediationAvailable();
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Determine security tier based on capabilities
   * @param {Object} capabilities - Capability flags
   * @returns {string} 'green' | 'yellow' | 'red' | 'blocked'
   */
  getTier(capabilities) {
    // Blocked: Missing critical features
    if (!capabilities.webauthn || !capabilities.subtleCrypto || !capabilities.indexedDB) {
      return 'blocked';
    }

    // Green: All security features available
    if (capabilities.visibilityApi) {
      return 'green';
    }

    // Yellow: WebAuthn + Crypto but missing visibility API
    return 'yellow';
  }

  /**
   * Get recommended configuration for a tier
   * @param {string} tier - Security tier
   * @returns {Object} Configuration recommendations
   */
  getRecommendedConfig(tier) {
    const configs = {
      green: {
        sessionDuration: 15 * 60 * 1000, // 15 minutes
        maxOperations: Infinity,
        autoLock: true,
        description: 'Maximum Security - Hardware-backed encryption'
      },
      yellow: {
        sessionDuration: 5 * 60 * 1000, // 5 minutes
        maxOperations: 1000,
        autoLock: false,
        description: 'Reduced Security - Manual lock recommended'
      },
      blocked: {
        sessionDuration: 0,
        maxOperations: 0,
        autoLock: false,
        description: 'Security features unavailable - BYOK disabled'
      }
    };

    return configs[tier] || configs.blocked;
  }

  /**
   * Get human-readable status message
   * @param {string} tier - Security tier
   * @param {Object} capabilities - Capability flags
   * @returns {Object} Status details
   */
  getStatus(tier, capabilities) {
    const messages = {
      green: {
        emoji: '🔒',
        title: 'Maximum Security',
        description: 'Hardware-backed encryption with device biometrics',
        color: '#4caf50',
        warnings: []
      },
      yellow: {
        emoji: '⚠️',
        title: 'Reduced Security',
        description: 'Hardware encryption enabled, manual session lock recommended',
        color: '#ff9800',
        warnings: [
          !capabilities.visibilityApi && 'Tab monitoring unavailable - lock sessions manually'
        ].filter(Boolean)
      },
      blocked: {
        emoji: '❌',
        title: 'BYOK Unavailable',
        description: 'Browser lacks required security features',
        color: '#f44336',
        warnings: [
          !capabilities.webauthn && 'WebAuthn (passkeys) not supported',
          !capabilities.subtleCrypto && 'Web Crypto API not available',
          !capabilities.indexedDB && 'IndexedDB not available'
        ].filter(Boolean)
      }
    };

    return messages[tier] || messages.blocked;
  }

  /**
   * Get analytics data (no PII)
   * @param {Object} capabilities - Capability flags
   * @param {string} tier - Security tier
   * @returns {Object} Analytics payload
   */
  getAnalytics(capabilities, tier) {
    return {
      tier,
      webauthn: capabilities.webauthn,
      subtleCrypto: capabilities.subtleCrypto,
      visibilityApi: capabilities.visibilityApi,
      indexedDB: capabilities.indexedDB,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: capabilities.timestamp
    };
  }
}
