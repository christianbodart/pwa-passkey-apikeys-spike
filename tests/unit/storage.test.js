// tests/unit/storage.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

describe('IndexedDB Storage', () => {
  let db;
  const DB_NAME = 'pwa-apikeys-v1';
  const STORE_NAME = 'keys';

  beforeEach(async () => {
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
    // Clean up databases between tests
    indexedDB.deleteDatabase(DB_NAME);
  });

  describe('Database Initialization', () => {
    it('creates database with correct name and version', () => {
      expect(db.name).toBe(DB_NAME);
      expect(db.version).toBe(1);
    });

    it('creates object store with correct name', () => {
      expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
    });

    it('uses "provider" as keyPath', async () => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      expect(store.keyPath).toBe('provider');
    });
  });

  describe('Record Storage', () => {
    it('stores a record with provider key', async () => {
      const record = {
        provider: 'openai',
        credentialId: new Uint8Array([1, 2, 3]),
        created: Date.now()
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // Verify stored
      const retrieved = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      expect(retrieved.provider).toBe('openai');
      expect(retrieved.credentialId).toEqual(new Uint8Array([1, 2, 3]));
      expect(retrieved.created).toBeDefined();
    });

    it('stores encrypted API key data', async () => {
      const record = {
        provider: 'openai',
        credentialId: new Uint8Array([1, 2, 3]),
        encKeyMaterial: new ArrayBuffer(32), // AES-256 key
        iv: new Uint8Array(12), // GCM IV
        encrypted: new ArrayBuffer(64) // Ciphertext
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      const retrieved = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
      });

      expect(retrieved.encKeyMaterial).toBeInstanceOf(ArrayBuffer);
      expect(retrieved.encKeyMaterial.byteLength).toBe(32);
      expect(retrieved.iv).toBeInstanceOf(Uint8Array);
      expect(retrieved.iv.length).toBe(12);
      expect(retrieved.encrypted).toBeInstanceOf(ArrayBuffer);
    });

    it('overwrites existing record with same provider key', async () => {
      // Store initial record
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: 'openai',
          credentialId: new Uint8Array([1, 2, 3]),
          created: 1000
        });
        req.onsuccess = () => resolve();
      });

      // Overwrite with new data
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          provider: 'openai',
          credentialId: new Uint8Array([4, 5, 6]),
          created: 2000
        });
        req.onsuccess = () => resolve();
      });

      const retrieved = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
      });

      expect(retrieved.created).toBe(2000);
      expect(retrieved.credentialId).toEqual(new Uint8Array([4, 5, 6]));
    });
  });

  describe('Record Retrieval', () => {
    beforeEach(async () => {
      // Seed test data
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          provider: 'openai',
          credentialId: new Uint8Array([1, 2, 3])
        });
        store.put({
          provider: 'anthropic',
          credentialId: new Uint8Array([4, 5, 6])
        });
        tx.oncomplete = () => resolve();
      });
    });

    it('retrieves existing record by provider', async () => {
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('openai');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record).toBeDefined();
      expect(record.provider).toBe('openai');
    });

    it('returns undefined for non-existent provider', async () => {
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('nonexistent');
        req.onsuccess = () => resolve(req.result);
      });

      expect(record).toBeUndefined();
    });
  });

  describe('Transaction Error Handling', () => {
    it('throws error for invalid data (missing keyPath)', () => {
      // fake-indexeddb throws synchronously for missing keyPath
      expect(() => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ invalid: 'no provider key' });
      }).toThrow();
    });

    it('handles valid transaction errors', async () => {
      // Test a scenario that triggers an async error
      // For example, trying to read from a closed transaction
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      // Close the transaction by completing it
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });

      // Now trying to use the store should fail
      // Note: fake-indexeddb might handle this differently than real browsers
      expect(() => {
        store.get('test');
      }).toThrow();
    });
  });

  describe('Multiple Providers', () => {
    it('stores records for different providers independently', async () => {
      const providers = ['openai', 'anthropic', 'google'];
      
      // Store multiple records
      for (const provider of providers) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put({
            provider,
            credentialId: new Uint8Array([providers.indexOf(provider)])
          });
          req.onsuccess = () => resolve();
        });
      }

      // Verify all stored
      for (const provider of providers) {
        const record = await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(provider);
          req.onsuccess = () => resolve(req.result);
        });
        expect(record.provider).toBe(provider);
      }
    });
  });
});
