// tests/helpers/storage-helpers.js
/**
 * IndexedDB operation helpers with timeout and error handling
 * Provides robust promise wrappers for common database operations
 */

const DEFAULT_TIMEOUT = 5000; // 5 seconds
const DB_NAME = 'pwa-apikeys-v1';
const STORE_NAME = 'keys';

/**
 * Wrap IndexedDB request in promise with timeout
 * @param {IDBRequest} request - IndexedDB request object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<any>}
 */
export function withTimeout(request, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout}ms`));
    }, timeout);

    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };

    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error || new Error('Database operation failed'));
    };
  });
}

/**
 * Wrap transaction in promise with timeout
 * @param {IDBTransaction} transaction - IndexedDB transaction
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export function transactionComplete(transaction, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Transaction timed out after ${timeout}ms`));
    }, timeout);

    transaction.oncomplete = () => {
      clearTimeout(timer);
      resolve();
    };

    transaction.onerror = () => {
      clearTimeout(timer);
      reject(transaction.error || new Error('Transaction failed'));
    };

    transaction.onabort = () => {
      clearTimeout(timer);
      reject(new Error('Transaction aborted'));
    };
  });
}

/**
 * Initialize test database
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<IDBDatabase>}
 */
export async function initTestDB(timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Database initialization timed out after ${timeout}ms`));
    }, timeout);

    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'provider' });
      }
    };

    req.onsuccess = () => {
      clearTimeout(timer);
      resolve(req.result);
    };

    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error || new Error('Failed to open database'));
    };
  });
}

/**
 * Put record into database
 * @param {IDBDatabase} db - Database instance
 * @param {object} record - Record to store (must have 'provider' field)
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function putRecord(db, record, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const request = store.put(record);
  
  await withTimeout(request, timeout);
  await transactionComplete(tx, timeout);
}

/**
 * Get record from database by provider
 * @param {IDBDatabase} db - Database instance
 * @param {string} provider - Provider name
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<object|undefined>}
 */
export async function getRecord(db, provider, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(provider);
  
  return await withTimeout(request, timeout);
}

/**
 * Delete record from database
 * @param {IDBDatabase} db - Database instance
 * @param {string} provider - Provider name
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function deleteRecord(db, provider, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const request = store.delete(provider);
  
  await withTimeout(request, timeout);
  await transactionComplete(tx, timeout);
}

/**
 * Get all records from database
 * @param {IDBDatabase} db - Database instance
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<object[]>}
 */
export async function getAllRecords(db, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  
  return await withTimeout(request, timeout);
}

/**
 * Count records in database
 * @param {IDBDatabase} db - Database instance
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<number>}
 */
export async function countRecords(db, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.count();
  
  return await withTimeout(request, timeout);
}

/**
 * Clear all records from database
 * @param {IDBDatabase} db - Database instance
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function clearAllRecords(db, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const request = store.clear();
  
  await withTimeout(request, timeout);
  await transactionComplete(tx, timeout);
}

/**
 * Close database safely
 * @param {IDBDatabase} db - Database instance
 */
export function closeDB(db) {
  if (db) {
    db.close();
  }
}

/**
 * Delete database
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function deleteDB(timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Database deletion timed out after ${timeout}ms`));
    }, timeout);

    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      clearTimeout(timer);
      resolve();
    };

    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error || new Error('Failed to delete database'));
    };

    request.onblocked = () => {
      clearTimeout(timer);
      reject(new Error('Database deletion blocked'));
    };
  });
}

/**
 * Create test record with encryption data
 * @param {string} provider - Provider name
 * @param {ArrayBuffer} credentialId - WebAuthn credential ID
 * @param {ArrayBuffer} encKeyMaterial - Encrypted key material
 * @param {Uint8Array} iv - Initialization vector
 * @param {ArrayBuffer} encrypted - Encrypted API key
 * @returns {object}
 */
export function createTestRecord(provider, credentialId, encKeyMaterial, iv, encrypted) {
  return {
    provider,
    credentialId,
    encKeyMaterial,
    iv,
    encrypted,
    created: Date.now()
  };
}

/**
 * Seed database with multiple test records
 * @param {IDBDatabase} db - Database instance
 * @param {object[]} records - Array of records to insert
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function seedRecords(db, records, timeout = DEFAULT_TIMEOUT) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  for (const record of records) {
    store.put(record);
  }
  
  await transactionComplete(tx, timeout);
}

/**
 * Export constants for test consistency
 */
export const constants = {
  DB_NAME,
  STORE_NAME,
  DEFAULT_TIMEOUT
};
