// app-ui.js - UI layer connecting DOM to refactored modules
import { PasskeyKeyManager } from './src/app.js';
import { PROVIDERS } from './src/providers.js';

class UIController {
  constructor() {
    this.manager = new PasskeyKeyManager();
    // Override updateStatus to update DOM
    this.manager.updateStatus = (msg) => this.updateStatus(msg);
  }

  async init() {
    try {
      await this.manager.init();
      await this.populateProviders();
      this.bindUI();
      await this.updateUIState();
    } catch (err) {
      console.error('Initialization failed:', err);
    }
  }

  async populateProviders() {
    const select = document.getElementById('provider');
    if (!select) return;

    // Check status for each provider and add to dropdown
    for (const [id, config] of Object.entries(PROVIDERS)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = config.name;
      option.dataset.providerId = id;
      select.appendChild(option);
    }

    // Update provider labels with status indicators
    await this.updateProviderStatus();
  }

  async updateProviderStatus() {
    const select = document.getElementById('provider');
    if (!select) return;

    // Check each provider for existing passkeys
    for (const option of select.options) {
      const providerId = option.dataset.providerId;
      if (!providerId) continue; // Skip the "Please select" option

      try {
        const status = await this.manager.getPasskeyStatus(providerId);
        const config = PROVIDERS[providerId];
        
        if (status.hasCredentialId) {
          option.textContent = `${config.name} ✓`;
        } else {
          option.textContent = config.name;
        }
      } catch (err) {
        console.error(`Failed to check status for ${providerId}:`, err);
      }
    }
  }

  bindUI() {
    const providerSelect = document.getElementById('provider');
    if (providerSelect) {
      providerSelect.onchange = () => this.updateUIState();
    }

    document.getElementById('register').onclick = () => this.handleCreatePasskey();
    document.getElementById('store').onclick = () => this.handleStoreKey();
    document.getElementById('test').onclick = () => this.handleTestCall();
  }

  async updateUIState() {
    const provider = document.getElementById('provider')?.value;
    const registerBtn = document.getElementById('register');
    const storeBtn = document.getElementById('store');
    const testBtn = document.getElementById('test');

    if (!provider) {
      // No provider selected
      if (registerBtn) registerBtn.disabled = true;
      if (storeBtn) storeBtn.disabled = true;
      if (testBtn) testBtn.disabled = true;
      this.updateStatus('👉 Select a provider to begin');
      return;
    }

    try {
      const status = await this.manager.getPasskeyStatus(provider);
      const providerName = PROVIDERS[provider]?.name || provider;

      // Update button states based on status
      if (registerBtn) {
        registerBtn.disabled = status.hasCredentialId;
      }

      if (storeBtn) {
        storeBtn.disabled = !status.hasCredentialId;
      }

      if (testBtn) {
        testBtn.disabled = !status.isComplete;
      }

      // Update status message
      if (status.isComplete) {
        this.updateStatus(`✅ ${providerName} is fully configured. Ready to test!`);
      } else if (status.hasCredentialId) {
        this.updateStatus(`🔑 ${providerName} passkey exists. You can store/update your API key.`);
      } else {
        this.updateStatus(`🆕 Ready to create passkey for ${providerName}`);
      }
    } catch (err) {
      console.error('Failed to update UI state:', err);
    }
  }

  getSelectedProvider() {
    const provider = document.getElementById('provider')?.value;
    if (!provider) {
      this.updateStatus('❌ Please select a provider first');
      return null;
    }
    return provider;
  }

  async handleCreatePasskey() {
    try {
      const provider = this.getSelectedProvider();
      if (!provider) return;

      await this.manager.createPasskey(provider);
      await this.updateProviderStatus();
      await this.updateUIState();
    } catch (err) {
      console.error('Create passkey failed:', err);
    }
  }

  async handleStoreKey() {
    try {
      const provider = this.getSelectedProvider();
      if (!provider) return;

      const apiKey = document.getElementById('apikey')?.value;

      if (!apiKey) {
        this.updateStatus('❌ Enter API key');
        return;
      }

      await this.manager.storeKey(provider, apiKey);
      
      // Clear input after successful store
      const apiKeyInput = document.getElementById('apikey');
      if (apiKeyInput) apiKeyInput.value = '';

      await this.updateProviderStatus();
      await this.updateUIState();
    } catch (err) {
      console.error('Store key failed:', err);
    }
  }

  async handleTestCall() {
    try {
      const provider = this.getSelectedProvider();
      if (!provider) return;

      const result = await this.manager.testCall(provider);

      // Display results
      const resultElement = document.getElementById('result');
      if (resultElement && result.success) {
        const displayData = result.data?.data?.slice(0, 3) || result.data?.models?.slice(0, 3) || [];
        resultElement.textContent = JSON.stringify(displayData, null, 2);
      }
    } catch (err) {
      console.error('Test call failed:', err);
    }
  }

  updateStatus(msg) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = msg;
    }
    console.log(msg);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const ui = new UIController();
  ui.init();
});
