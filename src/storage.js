// src/storage.js - IndexedDB storage operations
export class StorageService {
  constructor(dbName = 'pwa-apikeys-v1', storeName = 'keys') {
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
      
      req.onerror = (e) => {
        reject(new Error(`Database initialization failed: ${e.target.error?.message}`));
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
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put({ provider, ...data });
      
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Store failed: ${req.error?.message}`));
    });
  }

  /**
   * Retrieve a record from IndexedDB
   * @param {string} provider - Provider name (key)
   * @returns {Promise<Object|undefined>}
   */
  async get(provider) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(provider);
      
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(`Retrieval failed: ${req.error?.message}`));
    });
  }

  /**
   * Delete a record from IndexedDB
   * @param {string} provider - Provider name (key)
   * @returns {Promise<void>}
   */
  async delete(provider) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(provider);
      
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Deletion failed: ${req.error?.message}`));
    });
  }

  /**
   * Get all records from IndexedDB
   * @returns {Promise<Array>}
   */
  async getAll() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(`GetAll failed: ${req.error?.message}`));
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
