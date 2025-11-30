// app.js - Zero-Knowledge PWA Passkey API Keys
class PasskeyKeyManager {
  constructor() {
    this.dbName = 'pwa-apikeys-v1';
    this.storeName = 'keys';
    this.passcode = null;
    this.initDB();
    this.bindUI();
  }

  checkPasscode() {
    const input = prompt('Enter 4-digit PIN to unlock:');
    if (input && input.length === 4) {
      this.passcode = input;
      return true;
    }
    return false;
  }

  async initDB() {
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const store = db.createObjectStore(this.storeName, { keyPath: 'provider' });
        store.createIndex('provider', 'provider', { unique: true });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  bindUI() {
    document.getElementById('register').onclick = () => this.registerPasskey();
    document.getElementById('store').onclick = () => this.storeKey();
    document.getElementById('test').onclick = () => this.testCall();
  }

  async registerPasskey() {
    try {
      // Generate extractable key ONCE for storage
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable=true for initial storage
        ['encrypt', 'decrypt']
      );

      // Export key material ONCE and store
      const keyBuffer = await crypto.subtle.exportKey('raw', encKey);
      
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      await store.put({
        provider: 'openai',
        encKeyMaterial: keyBuffer,
        created: Date.now()
      });

      // Re-import as NON-EXTRACTABLE for runtime use
      const runtimeKey = await crypto.subtle.importKey(
        'raw', keyBuffer, { name: 'AES-GCM', length: 256 },
        false, // NOW non-extractable = device-bound
        ['encrypt', 'decrypt']
      );

      this.updateStatus('✅ Device-bound encryption key created!');
    } catch (err) {
      this.updateStatus(`❌ Key failed: ${err.message}`);
    }
  }

  async storeKey() {
    const provider = document.getElementById('provider').value || 'openai';
    const apiKey = document.getElementById('apikey').value;
    
    if (!apiKey) return this.updateStatus('❌ Enter API key');
    if (!await this.checkPasscode()) return this.updateStatus('❌ PIN required');

    try {
      const record = await this.getRecord(provider);
      if (!record || !record.encKeyMaterial) {
        return this.updateStatus('❌ Create encryption key first! (Button #1)');
      }

      const encKey = await this.getEncryptionKey(record);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(apiKey)
      );

      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      await store.put({ ...record, iv, encrypted, provider });

      this.updateStatus('✅ API key encrypted & stored!');
      document.getElementById('apikey').value = '';
    } catch (err) {
      this.updateStatus(`❌ Store failed: ${err.message}`);
    }
  }

  async getRecord(provider) {
    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const req = store.get(provider);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getEncryptionKey(record) {
    // Import with FULL encrypt/decrypt for store + test
    return crypto.subtle.importKey(
      'raw',
      record.encKeyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt'] // BOTH usages needed
    );
  }

  async testCall() {
    try {
      if (!await this.checkPasscode()) return this.updateStatus('❌ PIN required');
      
      this.updateStatus('🔐 Authenticating...');
      const record = await this.getRecord('openai');
      const encKey = await this.getEncryptionKey(record);
      
      this.updateStatus('🔓 Decrypting...');
      const apiKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv },
        encKey,
        record.encrypted
      );
      const keyStr = new TextDecoder().decode(apiKey);

      this.updateStatus('📡 Calling OpenAI...');
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${keyStr}` }
      });
      
      const data = await res.json();
      document.getElementById('result').textContent = JSON.stringify(data.data?.slice(0,3), null, 2);
      this.updateStatus(`✅ Success! ${data.data?.length || 0} models loaded.`);
    } catch (err) {
      this.updateStatus(`❌ Test failed: ${err.message}`);
    }
  }

  updateStatus(msg) {
    document.getElementById('status').textContent = msg;
    console.log(msg);
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => new PasskeyKeyManager());
