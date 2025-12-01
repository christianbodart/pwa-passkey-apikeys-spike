// src/storage.js - IndexedDB storage operations
import { StorageError } from './errors.js';
import { STORAGE_CONFIG } from './config.js';

export class StorageService {
  constructor(dbName = STORAGE_CONFIG.dbName, storeName = STORAGE_CONFIG.storeName) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, STORAGE_CONFIG.version);
      
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
      
      req.onerror = (e) => {
        reject(new StorageError(
          `Database initialization failed: ${e.target.error?.message}`,
          'INIT_FAILED'
        ));
      };
    });
  }

  /**
   * Store a record in IndexedDB
   * @param {string} provider - Provider name (key)
   * @param {Object} data - Data to store
   * @returns {Promise<void>}
   */
  async put(provider, data) {
    if (!this.db) {
      throw new StorageError(
        'Database not initialized. Call init() first.',
        'NOT_INITIALIZED'
      );
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put({ provider, ...data });
      
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(
        `Failed to store data: ${req.error?.message}`,
        'PUT_FAILED'
      ));
    });
  }

  /**
   * Retrieve a record from IndexedDB
   * @param {string} provider - Provider name (key)
   * @returns {Promise<Object|undefined>}
   */
  async get(provider) {
    if (!this.db) {
      throw new StorageError(
        'Database not initialized. Call init() first.',
        'NOT_INITIALIZED'
      );
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(provider);
      
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new StorageError(
        `Failed to retrieve data: ${req.error?.message}`,
        'GET_FAILED'
      ));
    });
  }

  /**
   * Delete a record from IndexedDB
   * @param {string} provider - Provider name (key)
   * @returns {Promise<void>}
   */
  async delete(provider) {
    if (!this.db) {
      throw new StorageError(
        'Database not initialized. Call init() first.',
        'NOT_INITIALIZED'
      );
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(provider);
      
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(
        `Failed to delete data: ${req.error?.message}`,
        'DELETE_FAILED'
      ));
    });
  }

  /**
   * Get all records from IndexedDB
   * @returns {Promise<Array>}
   */
  async getAll() {
    if (!this.db) {
      throw new StorageError(
        'Database not initialized. Call init() first.',
        'NOT_INITIALIZED'
      );
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new StorageError(
        `Failed to retrieve all data: ${req.error?.message}`,
        'GETALL_FAILED'
      ));
    });
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
