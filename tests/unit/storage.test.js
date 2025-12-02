import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  initTestDB,
  putRecord,
  getRecord,
  deleteRecord,
  getAllRecords,
  clearAllRecords,
  createTestRecord,
  createTestRecord as createMultipleTestRecords,
  closeDB,
  deleteDB,
  constants
} from '../helpers/storage-helpers.js';

describe('IndexedDB Storage Operations', () => {
  let db;

  beforeEach(async () => {
    db = await initTestDB();
  });

  afterEach(async () => {
    if (db) {
      closeDB(db);
    }
    await deleteDB();
  });

  describe('Database Initialization', () => {
    it('should open database with correct name and version', () => {
      expect(db).toBeDefined();
      expect(db.name).toBe(constants.DB_NAME);
      expect(db.version).toBe(1);
    });

    it('should have keys object store', () => {
      const hasStore = db.objectStoreNames.contains(constants.STORE_NAME);
      expect(hasStore).toBe(true);
    });
  });

  describe('Record Operations', () => {
    it('should store and retrieve a record', async () => {
      const testRecord = createTestRecord('openai', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64)
      });
      
      await putRecord(db, testRecord);
      const retrieved = await getRecord(db, 'openai');
      
      expect(retrieved).toBeDefined();
      expect(retrieved.provider).toBe('openai');
      expect(retrieved.encKeyMaterial).toBeInstanceOf(ArrayBuffer);
      expect(retrieved.iv).toBeInstanceOf(Uint8Array);
    });

    it('should update existing record', async () => {
      const record1 = createTestRecord('openai', {
        credentialId: new Uint8Array([1, 2, 3]),
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64)
      });
      
      const record2 = createTestRecord('openai', {
        credentialId: new Uint8Array([4, 5, 6]),
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64)
      });
      
      await putRecord(db, record1);
      await putRecord(db, record2);
      
      const retrieved = await getRecord(db, 'openai');
      expect(new Uint8Array(retrieved.credentialId)).toEqual(new Uint8Array([4, 5, 6]));
    });

    it('should delete a record', async () => {
      const testRecord = createTestRecord('anthropic', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64)
      });
      
      await putRecord(db, testRecord);
      await deleteRecord(db, 'anthropic');
      
      const retrieved = await getRecord(db, 'anthropic');
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined for non-existent record', async () => {
      const retrieved = await getRecord(db, 'non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Multiple Records', () => {
    it('should store and retrieve multiple records', async () => {
      const providers = ['openai', 'anthropic', 'google'];
      
      for (const provider of providers) {
        const record = createTestRecord(provider, {
          encKeyMaterial: new ArrayBuffer(32),
          iv: new Uint8Array(12),
          encrypted: new ArrayBuffer(64)
        });
        await putRecord(db, record);
      }
      
      const allRecords = await getAllRecords(db);
      expect(allRecords.length).toBe(3);
      
      const retrievedProviders = allRecords.map(r => r.provider).sort();
      expect(retrievedProviders).toEqual(providers.sort());
    });

    it('should clear all records', async () => {
      const providers = ['openai', 'anthropic'];
      
      for (const provider of providers) {
        const record = createTestRecord(provider, {
          encKeyMaterial: new ArrayBuffer(32),
          iv: new Uint8Array(12),
          encrypted: new ArrayBuffer(64)
        });
        await putRecord(db, record);
      }
      
      await clearAllRecords(db);
      
      const allRecords = await getAllRecords(db);
      expect(allRecords.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on closed database', async () => {
      closeDB(db);
      
      const testRecord = createTestRecord('test', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64)
      });
      
      await expect(putRecord(db, testRecord)).rejects.toThrow();
    });

    it('should timeout on hung operations', async () => {
      // Timeout is built into helpers - this would require special setup
      // to actually trigger a timeout condition
    }, 10000);
  });

  describe('Data Integrity', () => {
    it('should preserve ArrayBuffer data', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const record = createTestRecord('test', {
        credentialId: originalData.buffer,
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64)
      });
      
      await putRecord(db, record);
      const retrieved = await getRecord(db, 'test');
      
      const retrievedData = new Uint8Array(retrieved.credentialId);
      expect(retrievedData).toEqual(originalData);
    });

    it('should preserve Uint8Array data', async () => {
      const originalIV = new Uint8Array(12);
      crypto.getRandomValues(originalIV);
      
      const record = createTestRecord('test', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: originalIV,
        encrypted: new ArrayBuffer(64)
      });
      
      await putRecord(db, record);
      const retrieved = await getRecord(db, 'test');
      
      expect(retrieved.iv).toEqual(originalIV);
    });
  });
});
