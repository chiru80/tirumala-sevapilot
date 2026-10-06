# Testing & QA Guide — Tirumala SevaPilot

This document covers automated testing procedures, test suite breakdown, mock form fixtures, and manual verification steps.

---

## 🏃 Running Automated Tests

Run the Vitest test suite with:
```bash
npm test
```

Run TypeScript compilation check with:
```bash
npm run typecheck
```

---

## 📋 Automated Test Suites

### 1. `tests/validation/aadhaar.test.ts`
- Verhoeff algorithm parity check
- Generation of check digits
- Rejection of non-12-digit strings
- Rejection of leading `0` or `1`
- Rejection of identical repeating numbers (`999999999999`)

### 2. `tests/validation/validators.test.ts`
- Indian mobile (+91, 10-digit starting with 6-9)
- Email address formatting
- Postal PIN code verification (e.g. 517504 Tirumala)
- Date of Birth and age calculation
- Intra-profile duplicate ID collision detector

### 3. `tests/security/crypto.test.ts`
- Web Crypto PBKDF2 key derivation
- AES-GCM-256 encryption and decryption
- Rejection on incorrect password
- `.spbk` backup creation, serialization, and round-trip restore

### 4. `tests/content/field-mapper.test.ts`
- Scanned field extraction and multi-signal matching
- Confidence score calculation (VERY_HIGH, HIGH, MEDIUM, LOW)
- Name, mobile, DOB, and ID mapping

### 5. `tests/content/form-scanner.test.ts`
- DOM input, textarea, and select element discovery
- Parent card grouping for multi-pilgrim forms
- Exclusion of hidden inputs and submit buttons

### 6. `tests/services/adapters.test.ts`
- Service registry validation
- Service detection for Darshan, Arjitha Seva, Accommodation, SRIVANI, Srivari Seva, and Generic
- Fallback mechanics on unknown TTD paths

---

## 🧪 Manual QA Verification Checklist

1. **Side Panel Launch**:
   - Click extension icon in toolbar or press `Alt+Shift+S`.
   - Side panel opens smoothly on the right.
2. **First-Time Onboarding**:
   - Welcome screens introduce local privacy, disclaimer, and preparation tips.
   - Completing onboarding switches to main Dashboard.
3. **Pilgrim Creation & Editing**:
   - Add new pilgrim with 12-digit Aadhaar, name, DOB, phone, city, state.
   - Inline validator provides real-time green/red feedback.
4. **TTD Page Detection**:
   - Navigate to `https://ttdevasthanams.ap.gov.in/home/dashboard`.
   - Side panel status updates to "TTD Page Active" and identifies service as "Special Entry Darshan".
5. **Autofill Execution**:
   - Click "Scan Page" -> displays mapped fields preview.
   - Click "Autofill Fields" -> inputs populate and trigger React state change.
6. **Encrypted Backup Export/Import**:
   - Go to Backup tab, set a password, download `.spbk`.
   - Delete profile in Profiles tab.
   - Restore using `.spbk` and password -> profile is recovered intact.
