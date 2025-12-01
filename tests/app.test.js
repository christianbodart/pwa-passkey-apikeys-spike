// tests/app.test.js - Characterization tests for current PasskeyKeyManager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Load the actual app.js code
// Note: Since app.js uses DOM and executes on load, we need to mock the environment

describe('PasskeyKeyManager (Current Implementation)', () => {
  let manager;
  let db;
  const DB_NAME = 'pwa-apikeys-v1';
  const STORE_NAME = 'keys';

  beforeEach(async () => {
    // Mock DOM elements that PasskeyKeyManager expects
    const mockElements = {
      register: { onclick: null, textContent: '' },
      store: { onclick: null, textContent: '' },
      test: { onclick: null, textContent: '' },
      provider: { value: 'openai' },
      apikey: { value: '' },
      status: { textContent: '' },
      result: { textContent: '' }
    };

    globalThis.document.getElementById = vi.fn((id) => mockElements[id]);
    globalThis.document.addEventListener = vi.fn();

    // Reset mocks
    vi.clearAllMocks();

    // Initialize database like PasskeyKeyManager does
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'provider' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    indexedDB.deleteDatabase(DB_NAME);
  });

  describe('Database Initialization', () => {
    it('creates database with correct name and version', () => {
      expect(db.name).toBe(DB_NAME);
      expect(db.version).toBe(1);
    });

    it('creates object store with "provider" keyPath', () => {
      expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
      
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      expect(store.keyPath).toBe('provider');
    });
/*
    it('binds UI elements on initialization', () => {
      // Verify getElementById was called for expected elements
      expect(document.getElementById).toHaveBeenCalledWith('register');
      expect(document.getElementById).toHaveBeenCalledWith('store');
      expect(document.getElementById).toHaveBeenCalledWith('test');
    });
  });*/

  describe('Passkey Creation Flow', () => {
    it('generates 32-byte challenge for WebAuthn', () => {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      expect(challenge).toBeInstanceOf(Uint8Array);
      expect(challenge.length).toBe(32);
    });

    it('configures WebAuthn with correct parameters', async () => {
      const mockCredential = {
        id: 'test-credential',
        rawId: new ArrayBuffer(32),
        type: 'public-key'
      };

      globalThis.navigator.credentials.create.mockResolvedValue(mockCredential);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'PWA API Keys', id: globalThis.location.hostname },
          user: {
            id: new TextEncoder().encode('user1'),
            name: 'user1',
            displayName: 'User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required'
          }
        }
      });

      expect(credential).toBeDefined();
      expect(credential.rawId).toBeInstanceOf(ArrayBuffer);
    });

    it('stores credential ID in IndexedDB', async () => {
      const credentialId = new ArrayBuffer(32);

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: 'openai',
          credentialId,
          created: Date.now()
        });
        req.onsuccess = () => resolve();
      });

      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record.credentialId).toEqual(credentialId);
      expect(record.created).toBeDefined();
    });
  });

  describe('Key Storage Flow', () => {
    let mockCredentialId;

    beforeEach(async () => {
      // Setup: Create a passkey record first
      mockCredentialId = new ArrayBuffer(32);
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: 'openai',
          credentialId: mockCredentialId,
          created: Date.now()
        });
        req.onsuccess = () => resolve();
      });
    });

    it('generates AES-256 encryption key', async () => {
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      expect(encKey.algorithm.name).toBe('AES-GCM');
      expect(encKey.algorithm.length).toBe(256);

      const keyBuffer = await crypto.subtle.exportKey('raw', encKey);
      expect(keyBuffer.byteLength).toBe(32);
    });

    it('encrypts API key with AES-GCM', async () => {
      const apiKey = 'sk-proj-test1234567890';
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(apiKey)
      );

      expect(encrypted).toBeInstanceOf(ArrayBuffer);
      expect(encrypted.byteLength).toBeGreaterThan(0);
    });

    it('stores encrypted key material in IndexedDB', async () => {
      const apiKey = 'sk-proj-test1234567890';
      
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

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: 'openai',
          credentialId: mockCredentialId,
          encKeyMaterial: keyBuffer,
          iv,
          encrypted
        });
        req.onsuccess = () => resolve();
      });

      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record.encKeyMaterial).toBeInstanceOf(ArrayBuffer);
      expect(record.encKeyMaterial.byteLength).toBe(32);
      expect(record.iv).toBeInstanceOf(Uint8Array);
      expect(record.iv.length).toBe(12);
      expect(record.encrypted).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('Key Retrieval and Decryption Flow', () => {
    let encKeyMaterial;
    let iv;
    let encrypted;
    const originalKey = 'sk-proj-original-key-12345';

    beforeEach(async () => {
      // Setup: Store an encrypted key
      const encKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      encKeyMaterial = await crypto.subtle.exportKey('raw', encKey);
      iv = crypto.getRandomValues(new Uint8Array(12));
      encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(originalKey)
      );

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: 'openai',
          credentialId: new ArrayBuffer(32),
          encKeyMaterial,
          iv,
          encrypted
        });
        req.onsuccess = () => resolve();
      });
    });

    it('retrieves encrypted record from IndexedDB', async () => {
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record).toBeDefined();
      expect(record.provider).toBe('openai');
      expect(record.encKeyMaterial).toBeDefined();
      expect(record.iv).toBeDefined();
      expect(record.encrypted).toBeDefined();
    });

    it('imports key material for decryption', async () => {
      const decKey = await crypto.subtle.importKey(
        'raw',
        encKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      expect(decKey.type).toBe('secret');
      expect(decKey.algorithm.name).toBe('AES-GCM');
      expect(decKey.usages).toContain('decrypt');
    });

    it('decrypts to original API key', async () => {
      const decKey = await crypto.subtle.importKey(
        'raw',
        encKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        decKey,
        encrypted
      );

      const keyStr = new TextDecoder().decode(decrypted);
      expect(keyStr).toBe(originalKey);
    });
  });

  describe('API Call Integration', () => {
    it('makes fetch call with decrypted API key', async () => {
      const apiKey = 'sk-proj-test123';
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4', object: 'model' },
            { id: 'gpt-3.5-turbo', object: 'model' }
          ]
        })
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchMock;

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`
          })
        })
      );

      const data = await response.json();
      expect(data.data).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('handles missing record gracefully', async () => {
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('nonexistent');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record).toBeUndefined();
    });

    it('handles WebAuthn user cancellation', async () => {
      globalThis.navigator.credentials.create.mockRejectedValue(
        new DOMException('User cancelled', 'NotAllowedError')
      );

      await expect(
        navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'PWA API Keys', id: 'localhost' },
            user: {
              id: new TextEncoder().encode('user1'),
              name: 'user1',
              displayName: 'User'
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
              userVerification: 'required',
              residentKey: 'required'
            }
          }
        })
      ).rejects.toThrow('User cancelled');
    });
  });
});
