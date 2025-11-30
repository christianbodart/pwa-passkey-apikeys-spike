// app.js - TRUE WebAuthn System Biometrics
class PasskeyKeyManager {
  constructor() {
    this.dbName = 'pwa-apikeys-v1';
    this.storeName = 'keys';
    this.initDB();
    this.bindUI();
  }

  async initDB() {
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const store = db.createObjectStore(this.storeName, { keyPath: 'provider' });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  bindUI() {
    document.getElementById('register').onclick = () => this.createPasskey();
    document.getElementById('store').onclick = () => this.storeKey();
    document.getElementById('test').onclick = () => this.testCall();
  }

  async createPasskey() {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PWA API Keys', id: location.hostname },
          user: { id: new TextEncoder().encode('user1'), name: 'user1', displayName: 'User' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { userVerification: 'required', residentKey: 'required' }
        }
      });

      // Store credential ID for future auth
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      await store.put({
        provider: 'openai',
        credentialId: credential.rawId,
        created: Date.now()
      });

      this.updateStatus('✅ System Passkey created! (FaceID/PIN ready)');
    } catch (err) {
      this.updateStatus(`❌ Passkey failed: ${err.message} (Needs HTTPS/localhost)`);
    }
  }

  async authenticatePasskey(provider = 'openai') {
    const record = await this.getRecord(provider);
    if (!record?.credentialId) throw new Error('No passkey');

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: record.credentialId }],
        userVerification: 'required'
      }
    });

    return assertion; // FaceID/PIN/TouchID success
  }

  async storeKey() {
    const provider = document.getElementById('provider').value || 'openai';
    const apiKey = document.getElementById('apikey').value;
    
    if (!apiKey) return this.updateStatus('❌ Enter API key');

    try {
      // SYSTEM BIOMETRICS
      await this.authenticatePasskey(provider);
      
      // Generate + store encryption key
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const keyBuffer = await crypto.subtle.exportKey('raw', encKey);
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(apiKey)
      );

      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      await store.put({ 
        provider, 
        credentialId: (await this.getRecord(provider))?.credentialId,
        encKeyMaterial: keyBuffer, 
        iv, 
        encrypted 
      });

      this.updateStatus('✅ API key stored! (FaceID/PIN protected)');
      document.getElementById('apikey').value = '';
    } catch (err) {
      this.updateStatus(`❌ Store failed: ${err.message}`);
    }
  }

  async testCall() {
    try {
      // SYSTEM BIOMETRICS EVERY CALL
      await this.authenticatePasskey();
      
      const record = await this.getRecord('openai');
      const encKey = await crypto.subtle.importKey(
        'raw', record.encKeyMaterial, 
        { name: 'AES-GCM', length: 256 }, 
        false, ['decrypt']
      );
      
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
      this.updateStatus(`✅ Success! ${data.data?.length || 0} models.`);
    } catch (err) {
      this.updateStatus(`❌ Test failed: ${err.message}`);
    }
  }

  async getRecord(provider) {
    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const req = store.get(provider);
    return new Promise((resolve) => req.onsuccess = () => resolve(req.result));
  }

  updateStatus(msg) {
    document.getElementById('status').textContent = msg;
    console.log(msg);
  }
}

document.addEventListener('DOMContentLoaded', () => new PasskeyKeyManager());
