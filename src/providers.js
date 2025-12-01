// src/providers.js - Provider service for API interactions
import providersConfig from '../providers.json' with { type: 'json' };
import { ProviderError } from './errors.js';

export const PROVIDERS = providersConfig;

export class ProviderService {
  /**
   * Get provider configuration
   * @param {string} providerName
   * @returns {Object}
   */
  getProvider(providerName) {
    const provider = PROVIDERS[providerName.toLowerCase()];
    if (!provider) {
      throw new ProviderError(
        `Unknown provider: ${providerName}`,
        'UNKNOWN_PROVIDER'
      );
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

    try {
      return await fetch(url, {
        ...options,
        headers
      });
    } catch (error) {
      throw new ProviderError(
        `API call failed: ${error.message}`,
        'API_CALL_FAILED'
      );
    }
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
      if (error instanceof ProviderError) {
        return {
          success: false,
          error: error.message
        };
      }
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
