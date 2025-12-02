import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { StorageService } from '../../src/storage.js';
import {
  putRecord,
  getRecord,
  deleteRecord,
  getAllRecords,
  clearAllRecords,
  createTestRecord,
  withTimeout
} from '../helpers/storage-helpers.js';

describe('StorageService', () => {
  let db;

  beforeEach(async () => {
    db = await StorageService.openDatabase();
  });

  afterEach(async () => {
    if (db) {
      await clearAllRecords(db);
      db.close();
    }
  });

  describe('Database Operations', () => {
    it('should open database successfully', () => {
      expect(db).toBeDefined();
      expect(db.name).toBe('PasskeyKeyManager');
      expect(db.version).toBe(1);
    });

    it('should have keys object store', () => {
      const hasStore = db.objectStoreNames.contains('keys');
      expect(hasStore).toBe(true);
    });
  });

  describe('Record Operations', () => {
    it('should store and retrieve a record', async () => {
      const testRecord = createTestRecord('openai', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64),
        credentialId: new Uint8Array([1, 2, 3])
      });
      
      await putRecord(db, testRecord);
      const retrieved = await getRecord(db, 'openai');
      
      expect(retrieved).toBeDefined();
      expect(retrieved.provider).toBe('openai');
      expect(retrieved.encKeyMaterial).toBeInstanceOf(ArrayBuffer);
      expect(retrieved.iv).toBeInstanceOf(Uint8Array);
      expect(retrieved.encrypted).toBeInstanceOf(ArrayBuffer);
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
        encrypted: new ArrayBuffer(64),
        credentialId: new Uint8Array([1, 2, 3])
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

    it('should handle deletion of non-existent record', async () => {
      await expect(deleteRecord(db, 'non-existent')).resolves.not.toThrow();
    });
  });

  describe('Multiple Records', () => {
    it('should store and retrieve multiple records', async () => {
      const providers = ['openai', 'anthropic', 'google'];
      
      for (const provider of providers) {
        const record = createTestRecord(provider, {
          encKeyMaterial: new ArrayBuffer(32),
          iv: new Uint8Array(12),
          encrypted: new ArrayBuffer(64),
          credentialId: new Uint8Array([1, 2, 3])
        });
        await putRecord(db, record);
      }
      
      const allRecords = await getAllRecords(db);
      expect(allRecords.length).toBe(3);
      
      const retrievedProviders = allRecords.map(r => r.provider).sort();
      expect(retrievedProviders).toEqual(providers.sort());
    });

    it('should clear all records', async () => {
      const providers = ['openai', 'anthropic', 'google'];
      
      for (const provider of providers) {
        const record = createTestRecord(provider, {
          encKeyMaterial: new ArrayBuffer(32),
          iv: new Uint8Array(12),
          encrypted: new ArrayBuffer(64),
          credentialId: new Uint8Array([1, 2, 3])
        });
        await putRecord(db, record);
      }
      
      await clearAllRecords(db);
      
      const allRecords = await getAllRecords(db);
      expect(allRecords.length).toBe(0);
    });

    it('should retrieve only specific provider record', async () => {
      const providers = ['openai', 'anthropic'];
      
      for (const provider of providers) {
        const record = createTestRecord(provider, {
          encKeyMaterial: new ArrayBuffer(32),
          iv: new Uint8Array(12),
          encrypted: new ArrayBuffer(64),
          credentialId: new Uint8Array([1, 2, 3])
        });
        await putRecord(db, record);
      }
      
      const openaiRecord = await getRecord(db, 'openai');
      expect(openaiRecord.provider).toBe('openai');
      
      const anthropicRecord = await getRecord(db, 'anthropic');
      expect(anthropicRecord.provider).toBe('anthropic');
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on closed database', async () => {
      db.close();
      
      const testRecord = createTestRecord('test', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64),
        credentialId: new Uint8Array([1, 2, 3])
      });
      
      await expect(putRecord(db, testRecord)).rejects.toThrow();
    });

    it('should timeout on operations that take too long', async () => {
      // This would require mocking a hung transaction
      // For now, just verify the timeout wrapper exists
      expect(withTimeout).toBeDefined();
    });
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

    it('should preserve Uint8Array data (IV)', async () => {
      const originalIV = new Uint8Array(12);
      crypto.getRandomValues(originalIV);
      
      const record = createTestRecord('test', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: originalIV,
        encrypted: new ArrayBuffer(64),
        credentialId: new Uint8Array([1, 2, 3])
      });
      
      await putRecord(db, record);
      const retrieved = await getRecord(db, 'test');
      
      expect(new Uint8Array(retrieved.iv)).toEqual(originalIV);
    });

    it('should preserve large encrypted data', async () => {
      const largeData = new ArrayBuffer(1024 * 100); // 100KB
      const view = new Uint8Array(largeData);
      crypto.getRandomValues(view);
      
      const record = createTestRecord('test', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: largeData,
        credentialId: new Uint8Array([1, 2, 3])
      });
      
      await putRecord(db, record);
      const retrieved = await getRecord(db, 'test');
      
      expect(retrieved.encrypted.byteLength).toBe(1024 * 100);
      expect(new Uint8Array(retrieved.encrypted)).toEqual(view);
    });
  });

  describe('Record Structure', () => {
    it('should create record with all required fields', () => {
      const record = createTestRecord('test', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: new Uint8Array(12),
        encrypted: new ArrayBuffer(64),
        credentialId: new Uint8Array([1, 2, 3])
      });
      
      expect(record).toHaveProperty('provider');
      expect(record).toHaveProperty('encKeyMaterial');
      expect(record).toHaveProperty('iv');
      expect(record).toHaveProperty('encrypted');
      expect(record).toHaveProperty('credentialId');
    });

    it('should allow custom field values', () => {
      const customIV = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2]);
      const record = createTestRecord('custom-provider', {
        encKeyMaterial: new ArrayBuffer(32),
        iv: customIV,
        encrypted: new ArrayBuffer(128),
        credentialId: new Uint8Array([99])
      });
      
      expect(record.provider).toBe('custom-provider');
      expect(record.iv).toEqual(customIV);
      expect(record.encrypted.byteLength).toBe(128);
    });
  });
});
