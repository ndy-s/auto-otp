# AutOTP

**Your secrets, autofilled.**

---

## Why I Built This

It started with a small annoyance that kept growing.

Every time I logged into GitHub, AWS, my email, basically anything important, I'd hit the 2FA screen. And every single time, the same ritual: unlock my phone, open the authenticator app, squint at a six-digit code that's about to expire in 3 seconds, frantically type it in, and... *expired*. Do it again.

It sounds trivial. But multiply that by dozens of logins a day, across different devices, and it becomes death by a thousand paper cuts. I'm already sitting at my computer. My hands are already on the keyboard. Why do I need to reach for a completely separate device just to prove I'm me?

So I built **AutOTP**, a browser extension that stores your TOTP secrets locally and autofills those six-digit codes for you. No phone required. No app switching. No squinting. You log in, the code appears, and life moves on.

---

## But Wait, Is This Even Safe?

Fair question. Let's talk about it honestly.

### The tradeoff

Traditional authenticator apps (Google Authenticator, Authy, etc.) keep your secrets on your phone. That's a separate device, which means an attacker would need access to *both* your computer and your phone to break in. That separation is the whole point of two-factor authentication.

AutOTP moves one of those factors (the TOTP secret) onto the same device as your password. So yes, **if someone gains full access to your computer, they could potentially access both your passwords and your TOTP codes.** That's a real tradeoff, and you should be aware of it.

### When this tradeoff makes sense

- **You already use a password manager on your computer.** If your passwords are stored in your browser or in 1Password/Bitwarden on the same machine, your phone-based 2FA is already your *only* remaining separation. But honestly, most attacks don't involve someone physically sitting at your unlocked computer. They involve phishing, credential stuffing, or database breaches. TOTP still protects you against all of those, regardless of where the secret lives.

- **You work in low-risk environments.** If you're not a high-value target (government, large-scale infrastructure, crypto whales), the convenience gain likely outweighs the marginal security loss.

- **You're the only one with access to your machine.** Full-disk encryption + a strong login password + a locked screen when you walk away = your secrets are as safe here as they are on your phone.

### When you should NOT use this

- You share your computer with others.
- You work in a high-security environment with strict compliance requirements.
- You don't use full-disk encryption.

### What AutOTP does to stay safe

- **Everything is local.** Your secrets never leave your browser. No cloud sync, no remote servers, no analytics. Zero network requests.
- **Browser-encrypted storage.** Secrets are stored in `chrome.storage.local`, which is sandboxed per-extension and inaccessible to websites or other extensions.
- **No permissions beyond what's needed.** AutOTP only requests `storage`, `activeTab`, and `scripting`. Just the bare minimum to read pages and fill in codes.

---

## What It Does

### 🔑 Manage Your TOTP Secrets
Add, edit, search, and delete your 2FA secrets from a clean, dark-themed popup. Each entry shows the current six-digit code with a live countdown ring so you always know how much time you have left.

### 📷 Scan QR Codes
Instead of manually copying a 32-character Base32 string, you can:
- **Paste a screenshot.** Take a screenshot of the QR code (`Cmd+Shift+4` on Mac, `Win+Shift+S` on Windows), then press `Cmd+V` / `Ctrl+V` in the popup. Done.
- **Upload an image.** Click the image icon next to the secret field and select a saved QR code image.

The extension decodes the `otpauth://` URI automatically and fills in both the domain and the secret for you.

### ⚡ Autofill on Websites
When you visit a login page with a TOTP input field, AutOTP detects it and fills the code automatically. It works with standard HTML inputs and is smart enough to recognize common patterns (`autocomplete="one-time-code"`, fields named `totp`, `authcode`, `authenticator`, etc.). It even handles SPAs that load the input dynamically.

### ❓ Built-in Help
Click the `?` icon in the header for a quick guide on how to add secrets: paste, upload, or type manually.

---

## Getting Started

### Install

```bash
git clone https://github.com/ndy-s/autotp.git
cd autotp
npm install
npm run build
```

### Load in Your Browser

| Browser | Instructions |
|---|---|
| **Chrome / Edge / Brave** | Go to `chrome://extensions/` → Enable Developer Mode → Load unpacked → Select the `dist/` folder |
| **Firefox** | Go to `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → Select `dist/manifest.json` |
| **Safari** | Run `xcrun safari-web-extension-converter ./dist` → Build in Xcode → Enable in Safari preferences |

### Development

```bash
npm run dev    # Watches for changes and rebuilds automatically
```

---

## Tech Stack

- **TypeScript** for type-safe extension logic
- **Vite** + **@crxjs/vite-plugin** for fast builds and hot-reload
- **OTPAuth** for TOTP generation (RFC 6238 compliant)
- **qr-scanner** for client-side QR code decoding
- **Manifest V3** for cross-browser compatibility

---

## License

MIT
