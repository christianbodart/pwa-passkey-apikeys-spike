// src/providers.js - Provider configurations and API call utilities

/**
 * Supported API providers
 */
export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    testEndpoint: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    corsSupported: true
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    testEndpoint: '/messages',
    authHeader: 'x-api-key',
    authPrefix: '',
    corsSupported: true,
    additionalHeaders: {
      'anthropic-version': '2023-06-01'
    }
  },
  google: {
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    testEndpoint: '/models',
    authHeader: 'x-goog-api-key',
    authPrefix: '',
    corsSupported: false // Partial CORS support
  }
};

export class ProviderService {
  /**
   * Get provider configuration
   * @param {string} providerName
   * @returns {Object}
   */
  getProvider(providerName) {
    const provider = PROVIDERS[providerName.toLowerCase()];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    return provider;
  }

  /**
   * Make an API call to a provider
   * @param {string} providerName - Provider identifier
   * @param {string} apiKey - Decrypted API key
   * @param {string} endpoint - API endpoint (defaults to test endpoint)
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>}
   */
  async callProvider(providerName, apiKey, endpoint = null, options = {}) {
    const provider = this.getProvider(providerName);
    const url = `${provider.baseUrl}${endpoint || provider.testEndpoint}`;

    const headers = {
      ...options.headers,
      ...(provider.additionalHeaders || {})
    };

    // Set authentication header
    if (provider.authPrefix) {
      headers[provider.authHeader] = `${provider.authPrefix} ${apiKey}`;
    } else {
      headers[provider.authHeader] = apiKey;
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Test an API key by making a simple call
   * @param {string} providerName
   * @param {string} apiKey
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async testApiKey(providerName, apiKey) {
    try {
      const response = await this.callProvider(providerName, apiKey);
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get list of available providers
   * @returns {Array<{id: string, name: string, corsSupported: boolean}>}
   */
  listProviders() {
    return Object.entries(PROVIDERS).map(([id, config]) => ({
      id,
      name: config.name,
      corsSupported: config.corsSupported
    }));
  }
}
