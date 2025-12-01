# Architecture Documentation

## Overview

The application follows a **layered architecture** with clear separation of concerns, dependency injection, and event-driven communication.

## Architecture Diagram

```
┌────────────────────────────────────────┐
│          UI Layer (app-ui.js)            │
│  - DOM manipulation                       │
│  - Event handlers                         │
│  - Status updates                         │
└───────────────┬────────────────────────┘
               │
               │ Events & Callbacks
               │
┌──────────────┴────────────────────────┐
│   Business Logic (src/app.js)            │
│   PasskeyKeyManager                       │
│  - Orchestration                          │
│  - Validation                             │
│  - Event emission                         │
└──────┬──────┬──────┬──────┬──────┘
       │       │       │       │
       │       │       │       │
┌──────┴──────┴──────┴──────┴──────┐
│          Service Layer                   │
├───────────┬───────────┬───────────┤
│ Storage   │ Crypto    │ Passkey   │
│ Service   │ Service   │ Service   │
└───────────┴───────────┴───────────┘
            │           │
┌───────────┴───────────┴───────────┐
│    Browser APIs & Storage                │
│  - IndexedDB                              │
│  - WebAuthn                               │
│  - Web Crypto                             │
└────────────────────────────────────────┘
```

## Core Modules

### 1. PasskeyKeyManager (`src/app.js`)

**Role:** Business logic orchestrator

**Responsibilities:**
- Coordinate service interactions
- Validate inputs
- Emit events for UI updates
- Manage application workflow

**Dependencies (Injected):**
- `StorageService` - Data persistence
- `KeyManager` - Cryptographic operations
- `ProviderService` - API interactions
- `PasskeyService` - WebAuthn operations

**Key Features:**
- Dependency injection for testability
- Event emitter for decoupled communication
- Validation layer
- Custom error handling

### 2. PasskeyService (`src/passkey-service.js`)

**Role:** WebAuthn abstraction layer

**Responsibilities:**
- Create WebAuthn credentials
- Authenticate users
- Handle browser API errors
- Check WebAuthn support

**Benefits:**
- Isolates browser API dependencies
- Easier to mock for testing
- Standardized error handling
- Future-proof for new authenticator types

### 3. StorageService (`src/storage.js`)

**Role:** IndexedDB abstraction

**Responsibilities:**
- Initialize database
- CRUD operations
- Transaction management
- Error handling

**Configuration:** Uses `STORAGE_CONFIG` from `config.js`

### 4. KeyManager (`src/key-manager.js`)

**Role:** Cryptographic operations

**Responsibilities:**
- Generate AES-256 keys
- Encrypt/decrypt API keys
- Generate WebAuthn challenges
- Key import/export

**Configuration:** Uses `CRYPTO_CONFIG` from `config.js`

### 5. ProviderService (`src/providers.js`)

**Role:** API provider management

**Responsibilities:**
- Load provider configurations
- Make authenticated API calls
- Test API keys
- List available providers

**Configuration:** Loads from `providers.json`

## Error Handling

### Error Class Hierarchy

```
AppError (base)
├── PasskeyError
│   └── AuthenticationError
├── StorageError
├── CryptoError
├── ProviderError
└── ValidationError
```

### Error Classes (`src/errors.js`)

**AppError** - Base class with error code support

**PasskeyError** - WebAuthn/passkey operations
- `WEBAUTHN_NOT_SUPPORTED`
- `CREDENTIAL_CREATION_FAILED`
- `INVALID_STATE`

**AuthenticationError** - User authentication failures
- User cancelled
- Biometric failed

**StorageError** - IndexedDB operations
- `INIT_FAILED`
- `PUT_FAILED`
- `GET_FAILED`

**CryptoError** - Encryption/decryption
- `ENCRYPTION_FAILED`
- `DECRYPTION_FAILED`
- `KEY_GENERATION_FAILED`

**ProviderError** - API providers
- `UNKNOWN_PROVIDER`
- `API_CALL_FAILED`

**ValidationError** - Input validation
- Missing required fields
- Invalid types

### Usage Example

```javascript
try {
  await manager.createPasskey('openai');
} catch (err) {
  if (err instanceof AuthenticationError) {
    // User cancelled - show gentle message
  } else if (err instanceof PasskeyError) {
    // WebAuthn issue - show technical help
  } else {
    // Unexpected error - log and show generic message
  }
}
```

## Dependency Injection

### Pattern

```javascript
// Default services created if not provided
const manager = new PasskeyKeyManager();

// Or inject custom services for testing/customization
const manager = new PasskeyKeyManager({
  storage: mockStorage,
  keyManager: mockCrypto,
  passkeyService: mockPasskey,
  providerService: mockProvider,
  onStatusUpdate: (msg) => console.log(msg)
});
```

### Benefits

1. **Testability** - Easy to inject mocks
2. **Flexibility** - Swap implementations
3. **Maintainability** - Clear dependencies
4. **Decoupling** - Services don't know about each other

## Event System

### Available Events

```javascript
manager.on('initialized', ({ success, error }) => {});
manager.on('passkeyCreated', ({ provider }) => {});
manager.on('authenticated', ({ provider }) => {});
manager.on('keyStored', ({ provider }) => {});
manager.on('keyRetrieved', ({ provider }) => {});
manager.on('apiCallSuccess', ({ provider, result }) => {});
manager.on('apiCallFailed', ({ provider, error }) => {});
manager.on('status', (message) => {});
manager.on('providerDeleted', ({ provider }) => {});
```

### Usage

```javascript
const manager = new PasskeyKeyManager();

// Listen to events
manager.on('keyStored', ({ provider }) => {
  console.log(`Key saved for ${provider}`);
  updateUI();
});

manager.on('status', (msg) => {
  statusElement.textContent = msg;
});
```

## Configuration

### Config Files (`src/config.js`)

**WEBAUTHN_CONFIG**
- Relying party settings
- Algorithm preferences (ES256, RS256)
- Timeout values
- Authenticator selection

**STORAGE_CONFIG**
- Database name and version
- Store name

**CRYPTO_CONFIG**
- Encryption algorithm (AES-GCM)
- Key length (256 bits)
- IV length (12 bytes)

**APP_CONFIG**
- Retry limits
- Key expiration
- Debug mode

### Customization

Edit `src/config.js` to customize behavior:

```javascript
export const WEBAUTHN_CONFIG = {
  timeout: 120000, // Increase to 2 minutes
  algorithms: [
    { type: 'public-key', alg: -7 }  // Only ES256
  ]
};
```

## Testing Strategy

### Unit Tests

```javascript
// Test with mocks
const mockStorage = {
  init: () => Promise.resolve(),
  get: (provider) => Promise.resolve({ credentialId: new ArrayBuffer(32) })
};

const manager = new PasskeyKeyManager({ storage: mockStorage });

// Now storage is mocked
await manager.init();
```

### Integration Tests

Use real services but fake browser APIs:

```javascript
import 'fake-indexeddb/auto';

const manager = new PasskeyKeyManager();
// Uses real services with fake IndexedDB
```

## Security Considerations

### Defense in Depth

1. **Input Validation** - All inputs validated before processing
2. **Error Classes** - Specific errors prevent information leakage
3. **Event System** - Allows audit logging
4. **Dependency Injection** - Can inject security wrappers
5. **Configuration** - Centralized security settings

### Future Enhancements

- [ ] Add HMAC integrity checks
- [ ] Implement key rotation
- [ ] Add rate limiting
- [ ] Audit logging via events
- [ ] Content Security Policy
- [ ] Key expiration checks

## API Reference

### PasskeyKeyManager

```javascript
// Constructor
new PasskeyKeyManager({
  storage?: StorageService,
  keyManager?: KeyManager,
  providerService?: ProviderService,
  passkeyService?: PasskeyService,
  onStatusUpdate?: Function
})

// Methods
await manager.init()
await manager.createPasskey(provider)
await manager.authenticatePasskey(provider)
await manager.storeKey(provider, apiKey)
await manager.retrieveKey(provider)
await manager.testCall(provider)
await manager.getPasskeyStatus(provider)
await manager.deleteProvider(provider)
await manager.getAllProviders()
manager.on(event, callback)
manager.emit(event, data)
manager.destroy()
```

### PasskeyService

```javascript
passkeyService.isSupported()
await passkeyService.isConditionalMediationAvailable()
await passkeyService.createCredential(provider, challenge)
await passkeyService.authenticate(credentialId, challenge)
await passkeyService.silentAuthenticate(credentialId, challenge)
```

### StorageService

```javascript
await storage.init()
await storage.put(provider, data)
await storage.get(provider)
await storage.delete(provider)
await storage.getAll()
storage.close()
```

### KeyManager

```javascript
await keyManager.generateEncryptionKey(extractable)
await keyManager.exportKey(key)
await keyManager.importKey(keyBuffer, extractable)
await keyManager.encryptApiKey(apiKey, encryptionKey)
await keyManager.decryptApiKey(encrypted, iv, decryptionKey)
keyManager.generateChallenge(length)
```

---

**Architecture Version:** 2.0  
**Last Updated:** December 1, 2025  
**Production Ready:** Review security checklist first
