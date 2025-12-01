// src/passkey-service.js - WebAuthn passkey operations
import { PasskeyError, AuthenticationError } from './errors.js';
import { WEBAUTHN_CONFIG } from './config.js';

/**
 * Service for handling WebAuthn passkey operations
 */
export class PasskeyService {
  /**
   * Check if WebAuthn is supported
   * @returns {boolean}
   */
  isSupported() {
    return (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      navigator.credentials !== undefined
    );
  }

  /**
   * Check if conditional mediation is available (autofill support)
   * @returns {Promise<boolean>}
   */
  async isConditionalMediationAvailable() {
    if (window.PublicKeyCredential && 
        PublicKeyCredential.isConditionalMediationAvailable) {
      return await PublicKeyCredential.isConditionalMediationAvailable();
    }
    return false;
  }

  /**
   * Create a new WebAuthn credential (passkey)
   * @param {string} provider - Provider identifier
   * @param {Uint8Array} challenge - Cryptographic challenge
   * @returns {Promise<PublicKeyCredential>}
   */
  async createCredential(provider, challenge) {
    if (!this.isSupported()) {
      throw new PasskeyError(
        'WebAuthn is not supported in this browser',
        'WEBAUTHN_NOT_SUPPORTED'
      );
    }

    try {
      const userId = new TextEncoder().encode(`${provider}-${WEBAUTHN_CONFIG.user.name}`);
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: WEBAUTHN_CONFIG.rp.name,
            id: window.location.hostname
          },
          user: {
            id: userId,
            name: `${WEBAUTHN_CONFIG.user.name}-${provider}`,
            displayName: WEBAUTHN_CONFIG.user.displayName
          },
          pubKeyCredParams: WEBAUTHN_CONFIG.algorithms,
          authenticatorSelection: WEBAUTHN_CONFIG.authenticatorSelection,
          timeout: WEBAUTHN_CONFIG.timeout
        }
      });

      if (!credential) {
        throw new PasskeyError(
          'Failed to create credential',
          'CREDENTIAL_CREATION_FAILED'
        );
      }

      return credential;
    } catch (error) {
      if (error instanceof PasskeyError) {
        throw error;
      }

      // Map WebAuthn errors to our error types
      if (error.name === 'NotAllowedError') {
        throw new AuthenticationError(
          'User cancelled or authentication failed'
        );
      } else if (error.name === 'InvalidStateError') {
        throw new PasskeyError(
          'Authenticator is in an invalid state',
          'INVALID_STATE'
        );
      } else if (error.name === 'NotSupportedError') {
        throw new PasskeyError(
          'Operation not supported by authenticator',
          'NOT_SUPPORTED'
        );
      }

      throw new PasskeyError(
        `Passkey creation failed: ${error.message}`,
        'CREATION_FAILED'
      );
    }
  }

  /**
   * Authenticate using an existing credential
   * @param {ArrayBuffer} credentialId - Credential ID to authenticate with
   * @param {Uint8Array} challenge - Cryptographic challenge
   * @returns {Promise<PublicKeyCredential>}
   */
  async authenticate(credentialId, challenge) {
    if (!this.isSupported()) {
      throw new PasskeyError(
        'WebAuthn is not supported in this browser',
        'WEBAUTHN_NOT_SUPPORTED'
      );
    }

    if (!credentialId) {
      throw new PasskeyError(
        'Credential ID is required for authentication',
        'MISSING_CREDENTIAL_ID'
      );
    }

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              type: 'public-key',
              id: credentialId
            }
          ],
          userVerification: WEBAUTHN_CONFIG.authenticatorSelection.userVerification,
          timeout: WEBAUTHN_CONFIG.timeout
        }
      });

      if (!assertion) {
        throw new AuthenticationError('Authentication failed');
      }

      return assertion;
    } catch (error) {
      if (error instanceof PasskeyError) {
        throw error;
      }

      // Map WebAuthn errors
      if (error.name === 'NotAllowedError') {
        throw new AuthenticationError(
          'User cancelled or authentication failed'
        );
      } else if (error.name === 'InvalidStateError') {
        throw new PasskeyError(
          'Authenticator is in an invalid state',
          'INVALID_STATE'
        );
      }

      throw new AuthenticationError(
        `Authentication failed: ${error.message}`
      );
    }
  }

  /**
   * Silent authentication attempt (no UI)
   * @param {ArrayBuffer} credentialId - Credential ID
   * @param {Uint8Array} challenge - Challenge
   * @returns {Promise<boolean>}
   */
  async silentAuthenticate(credentialId, challenge) {
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ type: 'public-key', id: credentialId }],
          userVerification: 'preferred'
        },
        mediation: 'silent'
      });
      return true;
    } catch {
      return false;
    }
  }
}
