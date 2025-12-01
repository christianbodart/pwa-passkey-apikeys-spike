# 🗝️ PWA Passkey API Keys

**Zero-knowledge API key storage using WebAuthn passkeys.** Your API keys are encrypted with AES-256-GCM and protected by your device's biometric authentication (FaceID, TouchID, Windows Hello). Keys never leave your device and never touch any server.

👉 **[Live Demo](https://christianbodart.github.io/pwa-passkey-apikeys-spike/)**

## ✨ Features

- ✅ **WebAuthn Passkeys**: Biometric authentication (FaceID/TouchID/Windows Hello)
- ✅ **Zero-knowledge**: Server sees **zero** API keys - everything is client-side
- ✅ **AES-256-GCM Encryption**: Military-grade encryption for your keys
- ✅ **IndexedDB Storage**: Persistent encrypted storage in your browser
- ✅ **Multi-Provider Support**: OpenAI, Anthropic, Google AI (easily extensible)
- ✅ **Direct API Calls**: No proxy - `fetch()` directly to provider APIs
- ✅ **Smart UI**: Dynamic button states and provider status indicators
- ✅ **PWA**: Installable progressive web app with offline capability

## 🔒 Security Model

```
1. User creates passkey → WebAuthn credential stored in device secure enclave
2. User enters API key → Biometric authentication required
3. AES-256 key generated → API key encrypted with AES-GCM
4. Encrypted data stored in IndexedDB → Only ciphertext persisted
5. To use key → Biometric auth → Decrypt in memory → API call → Key erased
```

**Your API key never leaves your device in plaintext. Even malware would need:**
- Physical device access
- Your biometric data (fingerprint/face) OR device PIN
- Browser DevTools access during active decryption

## 🚀 Quick Start

### Option 1: Use Live Demo (Recommended)

Visit **[https://christianbodart.github.io/pwa-passkey-apikeys-spike/](https://christianbodart.github.io/pwa-passkey-apikeys-spike/)**

**Requirements:**
- Modern browser (Chrome 67+, Safari 13+, Firefox 60+)
- HTTPS or localhost (WebAuthn requirement)
- Device with biometric authentication or secure PIN

### Option 2: Run Locally

1. **Clone the repository**
```bash
git clone https://github.com/christianbodart/pwa-passkey-apikeys-spike.git
cd pwa-passkey-apikeys-spike
```

2. **Install dependencies** (for testing)
```bash
npm install
```

3. **Serve with HTTPS** (required for WebAuthn)
```bash
# Option A: Python
python -m http.server 8000

# Option B: Node.js
npx http-server

# Option C: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

4. **Open in browser**
```
http://localhost:8000
```

**Note:** For full passkey functionality, use `localhost` or deploy to HTTPS.

## 📚 Usage Guide

### Step 1: Select Provider
Choose from the dropdown:
- OpenAI
- Anthropic  
- Google AI

Providers with existing passkeys show a ✓ indicator.

### Step 2: Create Passkey
1. Select a provider without a passkey
2. Click "1. Create Passkey"
3. Complete biometric authentication (FaceID/TouchID/PIN)
4. Passkey is now bound to this provider

### Step 3: Store API Key
1. Select a provider with a passkey
2. Enter your API key in the password field
3. Click "2. Store API Key"
4. Authenticate with biometrics
5. Your key is encrypted and stored

### Step 4: Test API Call
1. Select a fully configured provider
2. Click "3. Test Call"
3. Authenticate with biometrics
4. See API response (e.g., list of models)

### Managing Multiple Providers

You can store separate API keys for each provider:
- Each provider gets its own passkey
- Each API key is encrypted separately
- Switch between providers using the dropdown

## 🏛️ Architecture

### Modular Design

```
pwa-passkey-apikeys-spike/
├── src/
│   ├── app.js           # Core orchestration (PasskeyKeyManager)
│   ├── storage.js       # IndexedDB operations (StorageService)
│   ├── key-manager.js   # Crypto operations (KeyManager)
│   └── providers.js     # API provider configs (ProviderService)
├── app-ui.js            # UI layer (UIController)
├── providers.json       # Provider configuration
├── index.html           # Entry point
└── app.legacy.js        # Original monolithic version (reference)
```

### Key Components

**PasskeyKeyManager** (`src/app.js`)
- Orchestrates passkey creation and authentication
- Manages encryption/decryption workflow
- Coordinates API calls

**StorageService** (`src/storage.js`)
- Abstracts IndexedDB operations
- Stores encrypted keys per provider
- Handles database initialization

**KeyManager** (`src/key-manager.js`)
- AES-256-GCM encryption/decryption
- Key generation and management
- WebAuthn challenge generation

**ProviderService** (`src/providers.js`)
- Manages provider configurations
- Handles API authentication headers
- Makes test API calls

**UIController** (`app-ui.js`)
- DOM event binding
- Dynamic button state management
- Provider status indicators

## 📦 Supported Providers

| Provider  | API Endpoint | CORS Support | Test Endpoint |
|-----------|--------------|--------------|---------------|
| OpenAI    | api.openai.com | ✅ Full | `/v1/models` |
| Anthropic | api.anthropic.com | ✅ Full | `/v1/messages` |
| Google AI | generativelanguage.googleapis.com | ⚠️ Partial | `/v1beta/models` |

### Adding New Providers

Edit `providers.json`:

```json
{
  "your-provider": {
    "name": "Your Provider",
    "baseUrl": "https://api.yourprovider.com/v1",
    "testEndpoint": "/test",
    "authHeader": "Authorization",
    "authPrefix": "Bearer",
    "corsSupported": true,
    "additionalHeaders": {
      "Custom-Header": "value"
    }
  }
}
```

The UI will automatically populate the dropdown.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── unit/
│   ├── crypto.test.js      # AES-GCM encryption tests
│   ├── storage.test.js     # IndexedDB tests
│   └── passkey.test.js     # WebAuthn tests
├── integration/
│   ├── key-lifecycle.test.js    # End-to-end flow
│   └── provider-calls.test.js   # API integration
└── app.test.js          # Main app tests
```

## 🔧 Troubleshooting

### "Passkey failed: NotAllowedError"
- **Cause:** User cancelled biometric prompt or WebAuthn not available
- **Solution:** Ensure HTTPS/localhost and try again

### "No passkey - create first"
- **Cause:** Trying to store key before creating passkey
- **Solution:** Click "Create Passkey" first for selected provider

### "API call failed: CORS error"
- **Cause:** Provider doesn't support CORS or requires proxy
- **Solution:** Check provider's CORS policy; may need backend proxy

### Passkeys not working in browser
- **Chrome:** Ensure version 67+
- **Safari:** Ensure version 13+ (iOS 14+)
- **Firefox:** Ensure version 60+
- **Must be:** HTTPS or localhost

### Clear all data and start over

```javascript
// In browser console:
indexedDB.deleteDatabase('pwa-apikeys-v1');
location.reload();
```

## 🚀 Deployment

### GitHub Pages (Current)

This repo is deployed to GitHub Pages automatically:

1. Push to `main` branch
2. GitHub Actions builds and deploys
3. Available at: `https://christianbodart.github.io/pwa-passkey-apikeys-spike/`

### Self-Hosting

1. Build is not required (vanilla JS)
2. Serve static files from any HTTPS server
3. Ensure HTTPS for WebAuthn to work

```bash
# Example: Deploy to Netlify
netlify deploy --prod --dir=.
```

## 📝 Documentation

- [REFACTORING.md](REFACTORING.md) - Architecture and refactoring details
- [JSDoc Comments](src/) - Inline documentation in source files
- [Test Files](tests/) - Usage examples and test cases

## 🔐 Security Considerations

### What This Protects Against
✅ Server-side data breaches (keys never sent to server)
✅ Man-in-the-middle attacks (keys never transmitted)
✅ XSS attacks stealing keys (keys encrypted at rest)
✅ Unauthorized access (biometric auth required)

### What This Does NOT Protect Against
⚠️ Malware with device access + keylogging
⚠️ Physical device theft with known PIN
⚠️ Browser/OS vulnerabilities
⚠️ Compromised API provider (they can still see requests)

### Production Recommendations

- [ ] Add server-side rate limiting
- [ ] Implement key rotation
- [ ] Add integrity checks (HMAC)
- [ ] Monitor for suspicious API usage patterns
- [ ] Use Content Security Policy (CSP)
- [ ] Implement audit logging
- [ ] Add key expiration

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

Fork, extend, productionize, or use as a learning resource.

## 👥 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🚀 Roadmap

- [ ] Key rotation support
- [ ] Export/import encrypted backup
- [ ] Multi-device sync (encrypted)
- [ ] Browser extension version
- [ ] TypeScript migration
- [ ] More provider integrations
- [ ] Admin dashboard for key management
- [ ] Audit log viewer

## ❓ FAQ

**Q: Is this production-ready?**
A: This is a spike/proof-of-concept. Review security considerations before production use.

**Q: Can I use this without biometrics?**
A: Yes, WebAuthn falls back to device PIN/password if biometrics unavailable.

**Q: What happens if I lose my device?**
A: Keys are device-bound. You'll need to re-enter API keys on a new device.

**Q: Can I sync keys across devices?**
A: Not currently. Each device needs separate passkey setup. (Future feature)

**Q: Is this better than password managers?**
A: Different use case. This is for API keys with direct browser API calls, not passwords.

---

**Built for the BYOK (Bring Your Own Key) future. Zero server trust required.**

👨‍💻 Made by [Christian Bodart](https://github.com/christianbodart) | 🐛 [Report Issues](https://github.com/christianbodart/pwa-passkey-apikeys-spike/issues)
