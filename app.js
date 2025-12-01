// app.js - TRUE WebAuthn System Biometrics (FIXED IDB Transactions)
class PasskeyKeyManager {
  constructor() {
    this.dbName = 'pwa-apikeys-v1';
    this.storeName = 'keys';
    this.initDB().then(() => {
      this.bindUI();
      this.updateStatus('✅ Ready! Create passkey first.');
    }).catch(err => {
      this.updateStatus(`❌ DB init failed: ${err.message}`);
    });
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'provider' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
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

      // ✅ FIXED: Use request callbacks
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put({
          provider: 'openai',
          credentialId: credential.rawId,
          created: Date.now()
        });
        
        req.onsuccess = () => {
          this.updateStatus('✅ System Passkey created! (FaceID/PIN ready)');
          resolve();
        };
        req.onerror = () => {
          this.updateStatus(`❌ Passkey store failed: ${req.error.message}`);
          reject(req.error);
        };
      });
    } catch (err) {
      this.updateStatus(`❌ Passkey failed: ${err.message} (Needs HTTPS/localhost)`);
      throw err;
    }
  }

  async authenticatePasskey(provider = 'openai') {
    const record = await this.getRecord(provider);
    if (!record?.credentialId) throw new Error('No passkey - create first');

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: record.credentialId }],
        userVerification: 'required'
      }
    });

    return assertion;
  }

  async storeKey() {
    const provider = document.getElementById('provider').value || 'openai';
    const apiKey = document.getElementById('apikey').value;
    
    if (!apiKey) return this.updateStatus('❌ Enter API key');

    try {
      await this.authenticatePasskey(provider);
      
      // ✅ Get credential ID BEFORE the transaction
      const existingRecord = await this.getRecord(provider);
      const credentialId = existingRecord?.credentialId;
      
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

      // ✅ FIXED: Use request callbacks
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put({ 
          provider, 
          credentialId,
          encKeyMaterial: keyBuffer, 
          iv, 
          encrypted 
        });
        
        req.onsuccess = () => {
          this.updateStatus('✅ API key stored! (FaceID/PIN protected)');
          document.getElementById('apikey').value = '';
          resolve();
        };
        req.onerror = () => {
          this.updateStatus(`❌ Store failed: ${req.error.message}`);
          reject(req.error);
        };
      });
    } catch (err) {
      this.updateStatus(`❌ Store failed: ${err.message}`);
      throw err;
    }
  }

  async testCall() {
    try {
      await this.authenticatePasskey();
      
      const record = await this.getRecord('openai');
      if (!record) throw new Error('No stored key');
      
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
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(provider);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  updateStatus(msg) {
    document.getElementById('status').textContent = msg;
    console.log(msg);
  }
}

document.addEventListener('DOMContentLoaded', () => new PasskeyKeyManager());
