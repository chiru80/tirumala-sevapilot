# Tirumala SevaPilot — TTD Booking Assistant

> **Prepare once. Fill accurately. Book yourself.**

**Tirumala SevaPilot** is a production-grade, privacy-first Google Chrome extension (Manifest V3) created to assist devotees in preparing pilgrim data in advance, validating credentials, organizing service-specific quotas, and safely autofilling official booking forms on the Tirumala Tirupati Devasthanams (TTD) portal.

---

## ⚠️ Important Legal & Official Status Disclaimer

> **INDEPENDENT THIRD-PARTY PRODUCTIVITY UTILITY**  
> Tirumala SevaPilot is **NOT** affiliated with, endorsed by, sponsored by, or in any way officially connected to the **Tirumala Tirupati Devasthanams (TTD)** or the **Government of Andhra Pradesh**.
>
> - This extension **does NOT guarantee** ticket availability, allotment, or successful checkout.
> - This extension **does NOT bypass** CAPTCHA, authentication, OTPs, waiting queues, or payment gateways.
> - Devotees must complete all OTP verification, CAPTCHA solving, slot selection, and payment transactions **manually**.
> - All pilgrim records are stored **strictly locally** inside your own browser and are never transmitted to external cloud servers.

---

## 🌟 Key Features

### 1. Local Encrypted Pilgrim Profiles & Groups
- Store family, friend, and group pilgrim details on your local machine.
- Web Crypto API (**PBKDF2** key derivation + **AES-GCM-256** encryption).
- Secure `.spbk` (SevaPilot Backup) export and restore for easy multi-device migration.

### 2. Comprehensive Pre-Booking Validation
- **Verhoeff Checksum Verification** for 12-digit Aadhaar numbers.
- Indian mobile number validator (+91, 10-digit).
- RFC email validation & 6-digit Indian Postal PIN verification.
- Date of Birth & automated age calculation.
- Cross-pilgrim duplicate ID detection within a profile.

### 3. TTD-Specific Service Adapters & Quota Limits
- **Special Entry Darshan (SED ₹300)**: Max 6 pilgrims.
- **Arjitha Seva (Suprabhatam, Kalyanotsavam, etc.)**: Max 2 pilgrims.
- **Accommodation (Tirumala / Tirupati Cottages & Guest Houses)**: Max 4 pilgrims.
- **SRIVANI Trust VIP Break Darshan**: Max 9 pilgrims.
- **Srivari Seva Voluntary Service**: Max 10 volunteers.
- **Generic TTD Fallback**: Best-effort mapping on arbitrary TTD forms.

### 4. React / Next.js-Aware Autofill Engine
- The TTD portal is built on modern frameworks (Next.js / React). Traditional browser autofill fails because synthetic events are not dispatched.
- SevaPilot uses native property setters (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) combined with synthetic `input`, `change`, and `blur` events so React state synchronizes seamlessly.
- Intelligent conflict detection and post-fill verification.

### 5. Premium Devotional Side Panel UX
- Modern side panel with Saffron/Gold devotional accents and full Dark/Light theme support.
- Multi-tab navigation: **Dashboard**, **Pilgrims**, **Groups**, **Documents**, **Readiness**, **Backup**, and **Settings**.
- Multi-language support: **English** and **Telugu (తెలుగు)**.

---

## 🚀 Quick Start / Local Installation

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd "TIRUMALA SEVAPILOT"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

4. **Load unpacked into Chrome**:
   1. Open Google Chrome and navigate to `chrome://extensions/`.
   2. Enable **Developer mode** toggle in the top-right corner.
   3. Click **Load unpacked**.
   4. Select the `dist/` directory inside this project folder.
   5. Pin SevaPilot to your toolbar and press `Alt+Shift+S` to open the Side Panel!

---

## 🧪 Testing

Run the automated test suite powered by Vitest:
```bash
npm test
```
Typecheck with TypeScript compiler:
```bash
npm run typecheck
```

---

## 📜 License
Independent open utility distributed under the ISC License.
