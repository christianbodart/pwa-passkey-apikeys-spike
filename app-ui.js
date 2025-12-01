// app-ui.js - UI layer connecting DOM to refactored modules
import { PasskeyKeyManager } from './src/app.js';
import { PROVIDERS } from './src/providers.js';
import { SESSION_CONFIG } from './src/config.js';

class UIController {
  constructor() {
    // Create manager with status update callback
    this.manager = new PasskeyKeyManager({
      onStatusUpdate: (msg) => this.updateStatus(msg)
    });
    
    // Session UI update interval
    this.sessionUpdateInterval = null;
    
    // Listen to events
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.manager.on('initialized', ({ success, error, blocked, tier, capabilities }) => {
      if (blocked) {
        this.disableControls();
      }
      this.updateSecurityBanner();
    });

    this.manager.on('capabilityDetected', (analytics) => {
      console.log('Capability Analytics:', analytics);
      // Send to analytics service (no PII)
      this.logCapabilities(analytics);
    });

    this.manager.on('passkeyCreated', ({ provider }) => {
      console.log(`Passkey created for ${provider}`);
    });

    this.manager.on('keyStored', ({ provider }) => {
      console.log(`API key stored for ${provider}`);
      this.updateSessionUI();
    });

    this.manager.on('sessionStarted', ({ provider }) => {
      console.log(`Session started for ${provider}`);
      this.updateSessionUI();
      this.startSessionTicker();
    });

    this.manager.on('sessionExpired', ({ provider }) => {
      console.log(`Session expired for ${provider}`);
      this.updateSessionUI();
      this.updateStatus(`🔒 Session expired for ${provider}`);
    });

    this.manager.on('sessionExtended', ({ provider }) => {
      console.log(`Session extended for ${provider}`);
    });

    this.manager.on('apiCallSuccess', ({ provider, result }) => {
      console.log(`API call successful for ${provider}:`, result);
    });
  }

  async init() {
    try {
      await this.manager.init();
      this.updateSecurityBanner();
      
      if (!this.manager.isBlocked) {
        await this.populateProviders();
        this.bindUI();
        await this.updateUIState();
      }
    } catch (err) {
      console.error('Initialization failed:', err);
      this.updateStatus(`❌ Fatal error: ${err.message}`);
    }
  }

  updateSecurityBanner() {
    const capInfo = this.manager.getCapabilities();
    const banner = document.getElementById('security-banner');
    const title = document.getElementById('security-title');
    const description = document.getElementById('security-description');
    const warnings = document.getElementById('security-warnings');
    
    banner.className = `tier-${capInfo.tier}`;
    title.innerHTML = `<span class="emoji">${capInfo.status.emoji}</span>${capInfo.status.title}`;
    description.textContent = capInfo.status.description;
    
    if (capInfo.status.warnings.length > 0) {
      warnings.innerHTML = capInfo.status.warnings
        .map(w => `<div class="warning-item">⚠️ ${w}</div>`)
        .join('');
    } else {
      warnings.innerHTML = '';
    }
  }

  disableControls() {
    const controls = document.getElementById('controls');
    if (controls) {
      controls.classList.add('controls-disabled');
    }
  }

  logCapabilities(analytics) {
    // In production, send to analytics service
    // For now, just log to console
    console.log('📊 Capability Analytics (no PII):', {
      tier: analytics.tier,
      features: {
        webauthn: analytics.webauthn,
        crypto: analytics.subtleCrypto,
        visibility: analytics.visibilityApi,
        indexedDB: analytics.indexedDB
      },
      browser: analytics.userAgent.split(' ')[0], // Just first part
      timestamp: new Date(analytics.timestamp).toISOString()
    });
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
        // Provider might not exist in config, skip
        console.warn(`Failed to check status for ${providerId}:`, err);
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
    document.getElementById('lock-btn').onclick = () => this.handleLockSession();
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
      this.hideSessionUI();
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

      // Update session UI
      this.updateSessionUI();

      // Update status message
      if (status.hasActiveSession) {
        this.updateStatus(`🔓 ${providerName} session active. No passkey required!`);
      } else if (status.isComplete) {
        this.updateStatus(`✅ ${providerName} is fully configured. Ready to test!`);
      } else if (status.hasCredentialId) {
        this.updateStatus(`🔑 ${providerName} passkey exists. You can store/update your API key.`);
      } else {
        this.updateStatus(`🆕 Ready to create passkey for ${providerName}`);
      }
    } catch (err) {
      console.error('Failed to update UI state:', err);
      this.updateStatus(`❌ Error: ${err.message}`);
    }
  }

  updateSessionUI() {
    const provider = document.getElementById('provider')?.value;
    if (!provider) {
      this.hideSessionUI();
      return;
    }

    const sessionInfo = this.manager.getSessionInfo(provider);
    const sessionStatus = document.getElementById('session-status');
    const sessionProvider = document.getElementById('session-provider');
    
    if (sessionInfo && sessionInfo.active) {
      const providerName = PROVIDERS[provider]?.name || provider;
      sessionProvider.textContent = providerName;
      sessionStatus.classList.add('active');
      this.updateSessionCountdown(sessionInfo.remaining);
    } else {
      this.hideSessionUI();
    }
  }

  hideSessionUI() {
    const sessionStatus = document.getElementById('session-status');
    if (sessionStatus) {
      sessionStatus.classList.remove('active');
    }
    this.stopSessionTicker();
  }

  updateSessionCountdown(remainingMs) {
    const countdownEl = document.getElementById('session-countdown');
    if (!countdownEl) return;

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    countdownEl.textContent = `(expires in ${timeStr})`;

    // Color coding
    countdownEl.classList.remove('warning', 'danger');
    if (remainingMs < 60000) { // < 1 minute
      countdownEl.classList.add('danger');
    } else if (remainingMs < SESSION_CONFIG.warningThreshold) {
      countdownEl.classList.add('warning');
    }
  }

  startSessionTicker() {
    this.stopSessionTicker();
    
    this.sessionUpdateInterval = setInterval(() => {
      const provider = document.getElementById('provider')?.value;
      if (!provider) {
        this.stopSessionTicker();
        return;
      }

      const sessionInfo = this.manager.getSessionInfo(provider);
      if (sessionInfo && sessionInfo.active) {
        this.updateSessionCountdown(sessionInfo.remaining);
      } else {
        this.hideSessionUI();
      }
    }, SESSION_CONFIG.updateInterval);
  }

  stopSessionTicker() {
    if (this.sessionUpdateInterval) {
      clearInterval(this.sessionUpdateInterval);
      this.sessionUpdateInterval = null;
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
      // Error message already shown by manager
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
      // Error message already shown by manager
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
      // Error message already shown by manager
    }
  }

  handleLockSession() {
    const provider = this.getSelectedProvider();
    if (!provider) return;

    this.manager.lockSession(provider);
    this.updateSessionUI();
    this.updateUIState();
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
