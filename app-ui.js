// app-ui.js - UI layer connecting DOM to refactored modules
import { PasskeyKeyManager } from './src/app.js';

class UIController {
  constructor() {
    this.manager = new PasskeyKeyManager();
    // Override updateStatus to update DOM
    this.manager.updateStatus = (msg) => this.updateStatus(msg);
  }

  async init() {
    try {
      await this.manager.init();
      this.bindUI();
    } catch (err) {
      console.error('Initialization failed:', err);
    }
  }

  bindUI() {
    document.getElementById('register').onclick = () => this.handleCreatePasskey();
    document.getElementById('store').onclick = () => this.handleStoreKey();
    document.getElementById('test').onclick = () => this.handleTestCall();
  }

  async handleCreatePasskey() {
    try {
      const provider = document.getElementById('provider')?.value || 'openai';
      await this.manager.createPasskey(provider);
    } catch (err) {
      console.error('Create passkey failed:', err);
    }
  }

  async handleStoreKey() {
    try {
      const provider = document.getElementById('provider')?.value || 'openai';
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
      const provider = document.getElementById('provider')?.value || 'openai';
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
