// src/app.js - Main application orchestrator
import { StorageService } from './storage.js';
import { KeyManager } from './key-manager.js';
import { ProviderService } from './providers.js';
import { PasskeyService } from './passkey-service.js';
import { SessionManager } from './session-manager.js';
import { ValidationError } from './errors.js';
import { SESSION_CONFIG } from './config.js';

export class PasskeyKeyManager {
  /**
   * Create a new PasskeyKeyManager
   * @param {Object} options - Configuration options
   * @param {StorageService} options.storage - Storage service instance
   * @param {KeyManager} options.keyManager - Key manager instance
   * @param {ProviderService} options.providerService - Provider service instance
   * @param {PasskeyService} options.passkeyService - Passkey service instance
   * @param {SessionManager} options.sessionManager - Session manager instance
   * @param {Function} options.onStatusUpdate - Status update callback
   */
  constructor(options = {}) {
    this.storage = options.storage || new StorageService();
    this.keyManager = options.keyManager || new KeyManager();
    this.providerService = options.providerService || new ProviderService();
    this.passkeyService = options.passkeyService || new PasskeyService();
    this.sessionManager = options.sessionManager || new SessionManager();
    this.onStatusUpdate = options.onStatusUpdate || ((msg) => console.log(msg));
    
    // Event listeners
    this.listeners = new Map();
    
    // Forward session events
    this.sessionManager.on('expired', ({ provider }) => {
      this.emit('sessionExpired', { provider });
    });
    this.sessionManager.on('started', ({ provider }) => {
      this.emit('sessionStarted', { provider });
    });
    this.sessionManager.on('extended', ({ provider }) => {
      this.emit('sessionExtended', { provider });
    });
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
   * Initialize the application
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await this.storage.init();
      this.updateStatus('✅ Ready! Select a provider and create a passkey.');
      this.emit('initialized', { success: true });
    } catch (err) {
      this.updateStatus(`❌ DB init failed: ${err.message}`);
      this.emit('initialized', { success: false, error: err });
      throw err;
    }
  }

  /**
   * Validate provider parameter
   * @param {string} provider
   * @throws {ValidationError}
   */
  validateProvider(provider) {
    if (!provider || typeof provider !== 'string') {
      throw new ValidationError('Provider is required and must be a string');
    }
    // This will throw ProviderError if provider doesn't exist
    this.providerService.getProvider(provider);
  }

  /**
   * Create a new WebAuthn passkey
   * @param {string} provider - Provider name (required)
   * @returns {Promise<void>}
   */
  async createPasskey(provider) {
    this.validateProvider(provider);

    try {
      const challenge = this.keyManager.generateChallenge();
      const credential = await this.passkeyService.createCredential(provider, challenge);

      await this.storage.put(provider, {
        credentialId: credential.rawId,
        created: Date.now()
      });

      this.updateStatus('✅ System Passkey created! (FaceID/PIN ready)');
      this.emit('passkeyCreated', { provider });
    } catch (err) {
      this.updateStatus(`❌ Passkey failed: ${err.message}`);
      this.emit('passkeyError', { provider, error: err });
      throw err;
    }
  }

  /**
   * Authenticate using WebAuthn passkey
   * @param {string} provider - Provider name (required)
   * @returns {Promise<PublicKeyCredential>}
   */
  async authenticatePasskey(provider) {
    this.validateProvider(provider);

    const record = await this.storage.get(provider);
    if (!record?.credentialId) {
      throw new ValidationError('No passkey found - create one first');
    }

    const challenge = this.keyManager.generateChallenge();
    const assertion = await this.passkeyService.authenticate(record.credentialId, challenge);

    this.emit('authenticated', { provider });
    return assertion;
  }

  /**
   * Store an encrypted API key
   * @param {string} provider - Provider name (required)
   * @param {string} apiKey - Plaintext API key
   * @returns {Promise<void>}
   */
  async storeKey(provider, apiKey) {
    this.validateProvider(provider);

    if (!apiKey || typeof apiKey !== 'string') {
      throw new ValidationError('API key is required and must be a string');
    }

    try {
      // Authenticate with passkey first
      await this.authenticatePasskey(provider);

      // Get existing credential ID
      const existingRecord = await this.storage.get(provider);
      const credentialId = existingRecord?.credentialId;

      // Generate encryption key and encrypt API key
      const encKey = await this.keyManager.generateEncryptionKey();
      const keyBuffer = await this.keyManager.exportKey(encKey);
      const { encrypted, iv } = await this.keyManager.encryptApiKey(apiKey, encKey);

      // Store encrypted data
      await this.storage.put(provider, {
        credentialId,
        encKeyMaterial: keyBuffer,
        iv,
        encrypted,
        updated: Date.now()
      });

      // Start session with decrypted key
      this.sessionManager.startSession(provider, apiKey);

      this.updateStatus('✅ API key stored! (FaceID/PIN protected)');
      this.emit('keyStored', { provider });
    } catch (err) {
      this.updateStatus(`❌ Store failed: ${err.message}`);
      this.emit('keyStoreError', { provider, error: err });
      throw err;
    }
  }

  /**
   * Retrieve and decrypt an API key (with session caching)
   * @param {string} provider - Provider name (required)
   * @returns {Promise<string>}
   */
  async retrieveKey(provider) {
    this.validateProvider(provider);

    // Check for active session first
    const cachedKey = this.sessionManager.getApiKey(provider);
    if (cachedKey) {
      // Extend session on use
      this.sessionManager.extendSession(provider);
      this.emit('keyRetrieved', { provider, fromCache: true });
      return cachedKey;
    }

    try {
      // No session - authenticate with passkey
      await this.authenticatePasskey(provider);

      // Get stored encrypted data
      const record = await this.storage.get(provider);
      if (!record || !record.encrypted) {
        throw new ValidationError('No stored key found');
      }

      // Import decryption key and decrypt
      const decKey = await this.keyManager.importKey(record.encKeyMaterial);
      const apiKey = await this.keyManager.decryptApiKey(
        record.encrypted,
        record.iv,
        decKey
      );

      // Start session with decrypted key
      this.sessionManager.startSession(provider, apiKey);

      this.emit('keyRetrieved', { provider, fromCache: false });
      return apiKey;
    } catch (err) {
      this.updateStatus(`❌ Retrieval failed: ${err.message}`);
      this.emit('keyRetrievalError', { provider, error: err });
      throw err;
    }
  }

  /**
   * Test API call with stored key
   * @param {string} provider - Provider name (required)
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async testCall(provider) {
    this.validateProvider(provider);

    try {
      this.updateStatus('📡 Calling API...');

      // Retrieve decrypted API key (may use session cache)
      const apiKey = await this.retrieveKey(provider);

      // Make test API call
      const result = await this.providerService.testApiKey(provider, apiKey);

      if (result.success) {
        const count = result.data?.data?.length || result.data?.models?.length || 0;
        this.updateStatus(`✅ Success! ${count} models.`);
        this.emit('apiCallSuccess', { provider, result });
      } else {
        this.updateStatus(`❌ API call failed: ${result.error}`);
        this.emit('apiCallFailed', { provider, error: result.error });
      }

      return result;
    } catch (err) {
      this.updateStatus(`❌ Test failed: ${err.message}`);
      this.emit('apiCallError', { provider, error: err });
      throw err;
    }
  }

  /**
   * Check passkey status for a provider
   * @param {string} provider - Provider name (required)
   * @returns {Promise<{hasCredentialId: boolean, hasEncryptedKey: boolean, isComplete: boolean}>}
   */
  async getPasskeyStatus(provider) {
    this.validateProvider(provider);

    const record = await this.storage.get(provider);
    const hasSession = this.sessionManager.hasSession(provider);
    
    return {
      hasCredentialId: !!(record && record.credentialId),
      hasEncryptedKey: !!(record && record.encrypted),
      isComplete: !!(record && record.credentialId && record.encrypted),
      hasActiveSession: hasSession,
      created: record?.created,
      updated: record?.updated
    };
  }

  /**
   * Get session info for a provider
   * @param {string} provider - Provider name
   * @returns {Object|null}
   */
  getSessionInfo(provider) {
    return this.sessionManager.getSessionInfo(provider);
  }

  /**
   * Lock (end) session for a provider
   * @param {string} provider - Provider name
   */
  lockSession(provider) {
    this.sessionManager.endSession(provider);
    this.updateStatus(`🔒 Session locked for ${provider}`);
  }

  /**
   * Lock all sessions
   */
  lockAllSessions() {
    this.sessionManager.endAllSessions();
    this.updateStatus('🔒 All sessions locked');
  }

  /**
   * Delete provider data
   * @param {string} provider - Provider name
   * @returns {Promise<void>}
   */
  async deleteProvider(provider) {
    this.validateProvider(provider);

    // End session if active
    this.sessionManager.endSession(provider);
    
    await this.storage.delete(provider);
    this.updateStatus(`✅ ${provider} data deleted`);
    this.emit('providerDeleted', { provider });
  }

  /**
   * Get all configured providers
   * @returns {Promise<Array>}
   */
  async getAllProviders() {
    const records = await this.storage.getAll();
    return records.map(record => ({
      provider: record.provider,
      hasPasskey: !!record.credentialId,
      hasApiKey: !!record.encrypted,
      hasActiveSession: this.sessionManager.hasSession(record.provider),
      created: record.created,
      updated: record.updated
    }));
  }

  /**
   * Update status message
   * @param {string} msg - Status message
   */
  updateStatus(msg) {
    this.onStatusUpdate(msg);
    this.emit('status', msg);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.sessionManager.endAllSessions();
    this.storage.close();
    this.listeners.clear();
    this.emit('destroyed', {});
  }
}
