# Test Suite Documentation

## 📁 Structure

```
tests/
├── helpers/           # Shared test utilities
│   └── index.js      # Mock creators, assertions, async helpers
├── fixtures/         # Test data and constants
│   └── index.js      # Keys, durations, provider names
├── unit/             # Isolated component tests
│   ├── capability-detector.test.js
│   ├── crypto.test.js
│   ├── errors.test.js
│   ├── passkey.test.js
│   ├── provider.test.js
│   ├── secure-cache.test.js
│   └── session-manager.test.js
├── integration/      # Multi-component workflows
│   ├── key-lifecycle.test.js
│   └── session-flow.test.js
├── app.test.js       # End-to-end application tests
└── setup.js          # Global test configuration
```

## 🚀 Running Tests

### All Tests
```bash
npm test              # Run all tests
npm run test:ui       # Interactive UI mode
npm run test:coverage # With coverage report
```

### Specific Suites
```bash
npm test unit/                    # Unit tests only
npm test integration/             # Integration tests only
npm test session-flow             # Specific test file
```

### Watch Mode
```bash
npm run test:watch               # Watch all
npm run test:watch session-flow  # Watch specific
```

## 🛠️ Writing Tests

### Use Helpers for Consistency

**✅ GOOD: Using helpers**
```javascript
import { 
  createMockCapabilityDetector,
  createMockPasskeyService,
  expectSessionActive,
  expectEvent,
  advanceTime
} from '../helpers/index.js';
import { TEST_KEYS, DURATIONS } from '../fixtures/index.js';

beforeEach(() => {
  mockCapabilityDetector = createMockCapabilityDetector('green');
  mockPasskeyService = createMockPasskeyService();
});

it('extends session on use', async () => {
  const callback = vi.fn();
  manager.on('sessionExtended', callback);
  
  await manager.retrieveKey('openai');
  
  expectEvent(callback, { 
    provider: 'openai',
    duration: expect.any(Number) 
  });
});
```

**❌ BAD: Manual mock setup**
```javascript
beforeEach(() => {
  mockCapabilityDetector = {
    detect: vi.fn().mockReturnValue({ /* 50 lines */ }),
    getTier: vi.fn().mockReturnValue('green'),
    // ... repetitive setup
  };
});

it('extends session on use', async () => {
  const callback = vi.fn();
  manager.on('sessionExtended', callback);
  
  await manager.retrieveKey('openai');
  
  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({ /* manual assertion */ })
  );
});
```

## 📦 Helper Functions

### Mock Creators

#### `createMockCapabilityDetector(tier)`
Creates a fully configured CapabilityDetector mock.

**Parameters:**
- `tier` (string): Security tier - `'green'`, `'yellow'`, `'red'`, or `'blocked'`

**Returns:** Mock detector with all methods configured

**Example:**
```javascript
const detector = createMockCapabilityDetector('yellow');
// Returns yellow tier config: 5min sessions, 100 max ops
```

#### `createMockPasskeyService()`
Creates a PasskeyService mock with standard responses.

**Returns:** Mock with `createCredential()` and `authenticate()` pre-configured

**Example:**
```javascript
const passkeyService = createMockPasskeyService();
await passkeyService.authenticate(); // Returns mock assertion
```

### Assertion Helpers

#### `expectSessionActive(sessionManager, provider)`
Asserts that a session exists and has a valid API key.

**Example:**
```javascript
expectSessionActive(manager.sessionManager, 'openai');
// ✅ Verifies hasSession() === true AND getApiKey() !== null
```

#### `expectSessionInactive(sessionManager, provider)`
Asserts that no active session exists.

**Example:**
```javascript
manager.lockSession('openai');
expectSessionInactive(manager.sessionManager, 'openai');
```

#### `expectEvent(callback, expectedData)`
Asserts event callback was called with matching data (order-insensitive).

**Example:**
```javascript
const callback = vi.fn();
manager.on('sessionExtended', callback);

// ... trigger event

expectEvent(callback, {
  provider: 'openai',
  duration: expect.any(Number)
});
// ✅ Matches regardless of property order
```

#### `expectEventOnce(callback, expectedData)`
Combines `toHaveBeenCalledTimes(1)` with `expectEvent()`.

### Time Manipulation

#### `advanceTime(ms)`
Advances fake timers by specified milliseconds.

**Example:**
```javascript
advanceTime(DURATIONS.sessionExpiry); // Skip to session expiry
```

#### `waitForAsync()`
Waits for pending async operations.

**Example:**
```javascript
await waitForAsync(); // Flush promise queue
```

## 📊 Test Fixtures

### Constants

```javascript
import { 
  TEST_KEYS,           // { openai: 'sk-...', anthropic: 'sk-...' }
  TEST_PROVIDERS,      // ['openai', 'anthropic', 'google']
  SESSION_DURATIONS,   // { green: 900000, yellow: 300000, ... }
  MAX_OPERATIONS,      // { green: Infinity, yellow: 100, ... }
  TEST_DB_NAMES,       // { integration: 'test-integration-db', ... }
  DURATIONS            // { immediate: 0, short: 100, ... }
} from '../fixtures/index.js';
```

### Usage Example

```javascript
// ✅ Use fixtures instead of hardcoded values
await manager.storeKey('openai', TEST_KEYS.openai);
advanceTime(DURATIONS.sessionExpiry);

// ❌ Don't hardcode
await manager.storeKey('openai', 'sk-test-123');
vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
```

## 🔬 Test Categories

### Unit Tests
**Purpose:** Test individual components in isolation  
**Characteristics:**
- No external dependencies (mocked)
- Fast execution (<10ms per test)
- Focused on single responsibility

**Example:**
```javascript
describe('SecureCache', () => {
  it('stores and retrieves values', () => {
    const cache = new SecureCache();
    cache.store('secret', 1000);
    expect(cache.retrieve()).toBe('secret');
  });
});
```

### Integration Tests
**Purpose:** Test component interactions and workflows  
**Characteristics:**
- Multiple real components
- Mocked external APIs only
- Tests realistic user flows

**Example:**
```javascript
describe('Session Flow Integration', () => {
  it('requires auth on first use, not on subsequent', async () => {
    // Create passkey
    await manager.createPasskey('openai');
    // Store key (auth #1)
    await manager.storeKey('openai', TEST_KEYS.openai);
    // Retrieve (no auth - session active)
    await manager.retrieveKey('openai');
    
    expect(mockPasskeyService.authenticate).toHaveBeenCalledOnce();
  });
});
```

### End-to-End Tests
**Purpose:** Test complete application behavior  
**Location:** `app.test.js`  
**Characteristics:**
- Full PasskeyKeyManager integration
- Real database (fake-indexeddb)
- Comprehensive scenarios

## ⏱️ Async Testing Best Practices

### Always Use Fake Timers

```javascript
beforeEach(() => {
  vi.useFakeTimers();  // ✅ Deterministic timing
});

afterEach(() => {
  vi.useRealTimers();  // ✅ Clean up
});

it('expires after 15 minutes', async () => {
  await manager.storeKey('openai', TEST_KEYS.openai);
  
  advanceTime(DURATIONS.sessionExpiry);
  
  expectSessionInactive(manager.sessionManager, 'openai');
});
```

### Cleanup Pattern

```javascript
afterEach(() => {
  manager?.destroy();        // Clean up manager
  vi.restoreAllMocks();      // Reset all mocks
  vi.useRealTimers();        // Reset timers
});
```

## 🐛 Debugging Tests

### Run Single Test
```bash
npm test -- --reporter=verbose session-flow.test.js
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--no-coverage"],
  "console": "integratedTerminal"
}
```

### Print Mock Calls
```javascript
console.log(mockPasskeyService.authenticate.mock.calls);
// Shows all arguments for each call
```

## 📈 Coverage Goals

- **Unit Tests:** >90% coverage per component
- **Integration Tests:** All critical user flows
- **Overall:** >85% line coverage

### Check Coverage
```bash
npm run test:coverage
# Opens HTML report in browser
```

## 🔄 Test Lifecycle

### Standard Pattern

```javascript
import { vi } from 'vitest';
import { createMockCapabilityDetector, createMockPasskeyService } from '../helpers/index.js';

describe('Feature', () => {
  let manager, mockService;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockService = createMockPasskeyService();
    manager = new PasskeyKeyManager({ /* config */ });
    await manager.init();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does something', async () => {
    // Test code
  });
});
```

## 🎯 Quick Reference

### Common Imports
```javascript
// Helpers
import {
  createMockCapabilityDetector,
  createMockPasskeyService,
  expectSessionActive,
  expectSessionInactive,
  expectEvent,
  advanceTime
} from '../helpers/index.js';

// Fixtures
import {
  TEST_KEYS,
  TEST_PROVIDERS,
  SESSION_DURATIONS,
  DURATIONS,
  TEST_DB_NAMES
} from '../fixtures/index.js';

// Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

### Test Metrics (Current)

- **Total Tests:** 58
- **Unit Tests:** 30
- **Integration Tests:** 28
- **Average Duration:** ~120ms
- **Success Rate:** 100% ✅

---

**Last Updated:** December 2, 2025  
**Maintainer:** @christianbodart