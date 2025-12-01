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
      this.populateProviders();
      this.bindUI();
    } catch (err) {
      console.error('Initialization failed:', err);
    }
  }

  populateProviders() {
    const select = document.getElementById('provider');
    if (!select) return;

    // Add each provider from providers.json
    Object.entries(PROVIDERS).forEach(([id, config]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = config.name;
      select.appendChild(option);
    });
  }

  bindUI() {
    document.getElementById('register').onclick = () => this.handleCreatePasskey();
    document.getElementById('store').onclick = () => this.handleStoreKey();
    document.getElementById('test').onclick = () => this.handleTestCall();
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
