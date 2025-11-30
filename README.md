# 🗝️ PWA Passkey API Keys

**Zero-knowledge client-side API key storage.** Keys encrypted with device-bound AES-256, never touch server. Works with OpenAI, Anthropic, etc.

[![Demo](demo.gif)](demo.gif)

## ✨ Features
- ✅ **Zero-knowledge**: Server sees **zero** API keys
- ✅ **Device-bound**: AES keys non-exportable (`extractable: false`)
- ✅ **IndexedDB**: Persistent encrypted storage
- ✅ **Direct calls**: `fetch()` to provider APIs (OpenAI CORS ✅)
- ✅ **PWA**: Installable, offline-capable

## 🚀 Quick Start (2 Minutes)

1. Clone & open
git clone <your-repo>
code .

2. Live Server (VS Code extension)
Right-click index.html → "Open with Live Server"

3. Flow:
"Create Encryption Key" → ✅ Device-bound key

Provider: "openai" | sk-... → "Store API Key" → ✅ Encrypted

"Test Call" → OpenAI models JSON ✅

text

## 🛡️ Security Model

User API Key (sk-...)
↓ Encrypt (AES-GCM, device-bound key)
IndexedDB (ciphertext only)
↓ Decrypt (ephemeral memory)
Direct fetch() → api.openai.com

text

**Key never leaves device.** Malware needs physical access + dev tools to extract.

## 📱 Providers Supported

| Provider  | Direct Calls     | CORS  |
|-----------|------------------|-------|
| OpenAI    | ✅ `/v1/models`  | ✅    |
| Anthropic | ✅ `/v1/messages`| ✅    |
| Google AI | ⚠️ Limited       | Partial |

## 🏗️ Architecture

PWA (index.html + app.js)
├── Web Crypto API (AES-GCM)
├── IndexedDB (encrypted storage)
├── Service Worker (offline)
└── Direct Provider APIs (no proxy)

text

## 🔧 Extend

**Add provider** (`app.js`):
const PROVIDERS = {
openai: 'https://api.openai.com/v1',
anthropic: 'https://api.anthropic.com/v1'
};

text

**Future: Passkeys** (WebAuthn PRF over HTTPS).

## 📄 License
MIT - Fork, extend, productionize.

**Built for the BYOK future. No server trust required.**