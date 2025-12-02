import { withTimeout, retry } from './test-utils.js';

/**
 * Test helpers for IndexedDB storage operations
 */

/**
 * Wraps a database operation with timeout and error handling
 * @param {Function} operation - Function that returns a Promise
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Operation result
 */
export async function dbOperation(operation, timeout = 5000) {
  return withTimeout(
    retry(operation, 2),
    timeout,
    'Database operation'
  );
}

/**
 * Puts a record into the database
 * @param {IDBDatabase} db - Database instance
 * @param {Object} record - Record to store
 * @returns {Promise<void>}
 */
export async function putRecord(db, record) {
  return dbOperation(async () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      const request = store.put(record);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

/**
 * Gets a record from the database
 * @param {IDBDatabase} db - Database instance
 * @param {string} provider - Provider name
 * @returns {Promise<Object|undefined>} Retrieved record
 */
export async function getRecord(db, provider) {
  return dbOperation(async () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      const request = store.get(provider);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

/**
 * Deletes a record from the database
 * @param {IDBDatabase} db - Database instance
 * @param {string} provider - Provider name
 * @returns {Promise<void>}
 */
export async function deleteRecord(db, provider) {
  return dbOperation(async () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      const request = store.delete(provider);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

/**
 * Gets all records from the database
 * @param {IDBDatabase} db - Database instance
 * @returns {Promise<Array>} All records
 */
export async function getAllRecords(db) {
  return dbOperation(async () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

/**
 * Clears all records from the database
 * @param {IDBDatabase} db - Database instance
 * @returns {Promise<void>}
 */
export async function clearAllRecords(db) {
  return dbOperation(async () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

/**
 * Creates a test record matching the actual storage structure
 * Fields match what app.js stores in storage.put()
 * @param {string} provider - Provider name
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Test record
 */
export function createTestRecord(provider = 'test-provider', overrides = {}) {
  return {
    provider,
    credentialId: overrides.credentialId || new Uint8Array([1, 2, 3]),
    encKeyMaterial: overrides.encKeyMaterial || new ArrayBuffer(32),
    iv: overrides.iv || new Uint8Array(12),
    encrypted: overrides.encrypted || new ArrayBuffer(64),
    created: overrides.created || Date.now(),
    updated: overrides.updated || Date.now(),
    ...overrides
  };
}

/**
 * Creates multiple test records
 * @param {Array<string>} providers - Provider names
 * @returns {Array<Object>} Test records
 */
export function createMultipleTestRecords(providers = ['openai', 'anthropic', 'google']) {
  return providers.map(provider => createTestRecord(provider));
}

/**
 * Verifies a record has all required fields
 * @param {Object} record - Record to verify
 * @returns {boolean} True if valid
 */
export function validateRecord(record) {
  const requiredFields = ['provider', 'credentialId', 'encKeyMaterial', 'iv', 'encrypted'];
  return requiredFields.every(field => record && record[field] !== undefined);
}

// Re-export withTimeout for tests
export { withTimeout };
