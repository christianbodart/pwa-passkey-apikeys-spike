// src/app.js - Main application orchestrator
import { StorageService } from './storage.js';
import { KeyManager } from './key-manager.js';
import { ProviderService } from './providers.js';

export class PasskeyKeyManager {
  constructor() {
    this.storage = new StorageService();
    this.keyManager = new KeyManager();
    this.providerService = new ProviderService();
  }

  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await this.storage.init();
      this.updateStatus('✅ Ready! Create passkey first.');
    } catch (err) {
      this.updateStatus(`❌ DB init failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Create a new WebAuthn passkey
   * @param {string} provider - Provider name
   * @returns {Promise<void>}
   */
  async createPasskey(provider = 'openai') {
    try {
      const challenge = this.keyManager.generateChallenge();
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PWA API Keys', id: location.hostname },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256 (ECDSA with SHA-256)
            { type: 'public-key', alg: -257 } // RS256 (RSA with SHA-256)
          ],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      await this.storage.put(provider, {
        credentialId: credential.rawId,
        created: Date.now()
      });

      this.updateStatus('✅ System Passkey created! (FaceID/PIN ready)');
    } catch (err) {
      this.updateStatus(`❌ Passkey failed: ${err.message} (Needs HTTPS/localhost)`);
      throw err;
    }
  }

  /**
   * Authenticate using WebAuthn passkey
   * @param {string} provider - Provider name
   * @returns {Promise<PublicKeyCredential>}
   */
  async authenticatePasskey(provider = 'openai') {
    const record = await this.storage.get(provider);
    if (!record?.credentialId) {
      throw new Error('No passkey - create first');
    }

    const challenge = this.keyManager.generateChallenge();
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: record.credentialId }],
        userVerification: 'required'
      }
    });

    return assertion;
  }

  /**
   * Store an encrypted API key
   * @param {string} provider - Provider name
   * @param {string} apiKey - Plaintext API key
   * @returns {Promise<void>}
   */
  async storeKey(provider, apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
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
        encrypted
      });

      this.updateStatus('✅ API key stored! (FaceID/PIN protected)');
    } catch (err) {
      this.updateStatus(`❌ Store failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Retrieve and decrypt an API key
   * @param {string} provider - Provider name
   * @returns {Promise<string>}
   */
  async retrieveKey(provider) {
    try {
      // Authenticate with passkey first
      await this.authenticatePasskey(provider);

      // Get stored encrypted data
      const record = await this.storage.get(provider);
      if (!record || !record.encrypted) {
        throw new Error('No stored key found');
      }

      // Import decryption key and decrypt
      const decKey = await this.keyManager.importKey(record.encKeyMaterial);
      const apiKey = await this.keyManager.decryptApiKey(
        record.encrypted,
        record.iv,
        decKey
      );

      return apiKey;
    } catch (err) {
      this.updateStatus(`❌ Retrieval failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Test API call with stored key
   * @param {string} provider - Provider name
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async testCall(provider = 'openai') {
    try {
      this.updateStatus('📡 Calling API...');

      // Retrieve decrypted API key
      const apiKey = await this.retrieveKey(provider);

      // Make test API call
      const result = await this.providerService.testApiKey(provider, apiKey);

      if (result.success) {
        const count = result.data?.data?.length || result.data?.models?.length || 0;
        this.updateStatus(`✅ Success! ${count} models.`);
      } else {
        this.updateStatus(`❌ API call failed: ${result.error}`);
      }

      return result;
    } catch (err) {
      this.updateStatus(`❌ Test failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Update status message (override this in UI layer)
   * @param {string} msg - Status message
   */
  updateStatus(msg) {
    console.log(msg);
  }
}
