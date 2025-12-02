// tests/helpers/passkey-helpers.js
/**
 * WebAuthn passkey operation helpers
 * Provides reusable functions for credential creation and authentication
 */

/**
 * Default WebAuthn configuration
 */
const DEFAULT_CONFIG = {
  rpName: 'PWA API Keys',
  rpId: 'localhost',
  userName: 'user1',
  userDisplayName: 'Test User',
  timeout: 60000,
  algorithms: [
    { type: 'public-key', alg: -7 },  // ES256
    { type: 'public-key', alg: -257 } // RS256
  ]
};

/**
 * Generate cryptographically random challenge
 * @param {number} length - Challenge length in bytes (default: 32)
 * @returns {Uint8Array}
 */
export function generateChallenge(length = 32) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generates a random credential ID (base64url encoded)
 * @returns {string} Base64url encoded credential ID
 */
export function generateCredentialId() {
  const buffer = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create standard credential creation options
 * @param {object} overrides - Override default configuration
 * @returns {object} PublicKeyCredentialCreationOptions
 */
export function createCredentialOptions(overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  const userId = overrides.userId || new TextEncoder().encode(config.userName);
  
  return {
    publicKey: {
      challenge: overrides.challenge || generateChallenge(32),
      rp: {
        name: config.rpName,
        id: config.rpId
      },
      user: {
        id: userId,
        name: config.userName,
        displayName: config.userDisplayName
      },
      pubKeyCredParams: config.algorithms,
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'required',
        requireResidentKey: true
      },
      timeout: config.timeout,
      attestation: 'none'
    }
  };
}

/**
 * Create standard authentication options
 * @param {Uint8Array|ArrayBuffer} credentialId - Credential ID to authenticate with
 * @param {object} overrides - Override default configuration
 * @returns {object} PublicKeyCredentialRequestOptions
 */
export function getAssertionOptions(credentialId, overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  
  return {
    publicKey: {
      challenge: overrides.challenge || generateChallenge(32),
      allowCredentials: [
        {
          type: 'public-key',
          id: credentialId
        }
      ],
      userVerification: 'required',
      timeout: config.timeout
    }
  };
}

/**
 * Create test credential using standard options
 * @param {object} overrides - Override default configuration
 * @returns {Promise<PublicKeyCredential>}
 */
export async function createTestCredential(overrides = {}) {
  const options = createCredentialOptions(overrides);
  return await navigator.credentials.create(options);
}

/**
 * Get test assertion using standard options
 * @param {Uint8Array|ArrayBuffer} credentialId - Credential ID
 * @param {object} overrides - Override default configuration
 * @returns {Promise<PublicKeyCredential>}
 */
export async function getTestAssertion(credentialId, overrides = {}) {
  const options = getAssertionOptions(credentialId, overrides);
  return await navigator.credentials.get(options);
}

/**
 * Create mock credential response
 * @param {object} options - Mock credential options
 * @returns {object} Mock credential
 */
export function createMockCredential(options = {}) {
  const credentialId = options.credentialId || crypto.getRandomValues(new Uint8Array(32));
  
  return {
    id: options.id || 'mock-credential-id',
    rawId: credentialId.buffer || credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: options.clientDataJSON || new ArrayBuffer(128),
      attestationObject: options.attestationObject || new ArrayBuffer(256),
      authenticatorData: options.authenticatorData,
      signature: options.signature
    },
    getClientExtensionResults: () => ({})
  };
}

/**
 * Create mock assertion response
 * @param {Uint8Array|ArrayBuffer} credentialId - Credential ID
 * @param {object} options - Mock assertion options
 * @returns {object} Mock assertion
 */
export function createMockAssertion(credentialId, options = {}) {
  return {
    id: options.id || 'mock-assertion-id',
    rawId: credentialId.buffer || credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: options.clientDataJSON || new ArrayBuffer(128),
      authenticatorData: options.authenticatorData || new ArrayBuffer(64),
      signature: options.signature || new ArrayBuffer(64),
      userHandle: options.userHandle || new ArrayBuffer(16)
    },
    getClientExtensionResults: () => ({})
  };
}

/**
 * Setup standard navigator.credentials mocks
 * @param {object} vi - Vitest mock object
 * @param {object} mockResponses - Custom mock responses
 */
export function setupPasskeyMocks(vi, mockResponses = {}) {
  if (!globalThis.navigator) {
    globalThis.navigator = {};
  }
  
  if (!globalThis.navigator.credentials) {
    globalThis.navigator.credentials = {};
  }

  globalThis.navigator.credentials.create = vi.fn(
    mockResponses.create || (() => Promise.resolve(createMockCredential()))
  );
  
  globalThis.navigator.credentials.get = vi.fn(
    mockResponses.get || ((options) => {
      const credentialId = options?.publicKey?.allowCredentials?.[0]?.id || new Uint8Array(32);
      return Promise.resolve(createMockAssertion(credentialId));
    })
  );
}

/**
 * Verify credential creation was called with correct parameters
 * @param {object} mockFn - Mock function (vi.fn)
 * @param {object} expectedParams - Expected parameters to verify
 */
export function verifyCredentialCreation(mockFn, expectedParams = {}) {
  const calls = mockFn.mock.calls;
  if (calls.length === 0) {
    throw new Error('Credential creation was not called');
  }
  
  const lastCall = calls[calls.length - 1][0];
  const publicKey = lastCall.publicKey;
  
  const checks = {
    hasChallenge: () => publicKey.challenge instanceof Uint8Array,
    challengeLength: () => publicKey.challenge.length === (expectedParams.challengeLength || 32),
    hasRp: () => !!publicKey.rp,
    hasUser: () => !!publicKey.user,
    userVerification: () => publicKey.authenticatorSelection?.userVerification === 'required',
    residentKey: () => publicKey.authenticatorSelection?.residentKey === 'required'
  };
  
  return {
    publicKey,
    checks,
    verify: (checkNames = Object.keys(checks)) => {
      const results = {};
      for (const name of checkNames) {
        results[name] = checks[name]?.() ?? false;
      }
      return results;
    }
  };
}

/**
 * Verify assertion was called with correct parameters
 * @param {object} mockFn - Mock function (vi.fn)
 * @param {Uint8Array|ArrayBuffer} expectedCredentialId - Expected credential ID
 */
export function verifyAssertion(mockFn, expectedCredentialId = null) {
  const calls = mockFn.mock.calls;
  if (calls.length === 0) {
    throw new Error('Assertion was not called');
  }
  
  const lastCall = calls[calls.length - 1][0];
  const publicKey = lastCall.publicKey;
  
  const checks = {
    hasChallenge: () => publicKey.challenge instanceof Uint8Array,
    hasAllowCredentials: () => Array.isArray(publicKey.allowCredentials) && publicKey.allowCredentials.length > 0,
    userVerification: () => publicKey.userVerification === 'required',
    matchesCredentialId: () => {
      if (!expectedCredentialId) return true;
      const actualId = new Uint8Array(publicKey.allowCredentials[0].id);
      const expectedId = new Uint8Array(expectedCredentialId);
      return actualId.every((val, idx) => val === expectedId[idx]);
    }
  };
  
  return {
    publicKey,
    checks,
    verify: (checkNames = Object.keys(checks)) => {
      const results = {};
      for (const name of checkNames) {
        results[name] = checks[name]?.() ?? false;
      }
      return results;
    }
  };
}

/**
 * Create test user ID
 * @param {string} userName - User name
 * @returns {Uint8Array}
 */
export function createUserId(userName = 'user1') {
  return new TextEncoder().encode(userName);
}

/**
 * Export default configuration for tests
 */
export { DEFAULT_CONFIG };
