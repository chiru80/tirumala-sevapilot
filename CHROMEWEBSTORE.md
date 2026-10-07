# Chrome Web Store Submission Package — Tirumala SevaPilot

This document contains ready-to-copy metadata and compliance statements for publishing Tirumala SevaPilot to the Chrome Web Store.

---

## 📌 Extension Details

- **Title**: Tirumala SevaPilot — TTD Booking Assistant
- **Short Name**: SevaPilot
- **Version**: 1.1.0
- **Category**: Productivity / Accessibility
- **Primary Language**: English

---

## 📝 Short Description (Max 132 characters)
Prepare pilgrim information in advance, validate Aadhaar & contacts locally, and autofill official TTD booking forms accurately.

---

## 📖 Detailed Description (Store Listing)

> **Prepare once. Fill accurately. Book yourself.**

Tirumala SevaPilot is an independent third-party productivity assistant created for devotees who manually book darshan, arjitha seva, and accommodation on the official Tirumala Tirupati Devasthanams (TTD) portal (`ttdevasthanams.ap.gov.in`).

Booking windows for popular services often fill within minutes. Manual typing errors in 12-digit Aadhaar numbers, spelling of names, or phone numbers can delay your checkout or cause rejection at the Vaikuntam queue verification counters.

SevaPilot solves this by letting you organize, validate, and prepare your family's booking squads beforehand—and autofill them with one click when you reach the booking page.

### 🌟 Key Features:
- **Zero-Cloud Privacy**: All pilgrim data is stored locally in your browser. No servers, no tracking, no third-party analytics.
- **Aadhaar Verhoeff Verification**: Validates 12-digit Aadhaar numbers offline using the official Verhoeff checksum algorithm to catch typos before booking day.
- **Group Quota Manager**: Organize booking squads tailored to service limits (e.g., up to 6 pilgrims for Special Entry Darshan ₹300).
- **React-Aware Autofill**: Synchronizes natively with TTD's modern React/Next.js frontend so filled inputs are recognized instantly.
- **Devotional Side Panel**: Modern side panel with Saffron/Gold accents, dark mode, and Telugu (తెలుగు) language support.
- **Encrypted Backups**: Export and import your family records using AES-GCM-256 encryption.

---

### ⚠️ IMPORTANT DISCLAIMER:
- Tirumala SevaPilot is an **INDEPENDENT PRODUCTIVITY UTILITY** and is **NOT** affiliated with, endorsed by, or authorized by Tirumala Tirupati Devasthanams (TTD) or the Government of Andhra Pradesh.
- This extension **does NOT guarantee** ticket allotments.
- This extension **does NOT bypass** CAPTCHAs, queues, OTPs, or payment gateways. Devotees perform all verification and payment steps manually.

---

## 🔍 Single Purpose Description
The single purpose of Tirumala SevaPilot is to provide a local form-preparation utility that allows users to pre-fill their own verified personal and pilgrim identity information into booking forms on the official TTD website.

---

## 🔐 Permission Justifications for Reviewers

1. **`storage`**: Used to save user-entered pilgrim profiles, quota selections, and UI preferences locally on the client machine.
2. **`sidePanel`**: Used to display the assistant dashboard alongside the active booking tab without obscuring page content.
3. **`activeTab` & `scripting`**: Required to inspect the DOM of the active TTD page, detect form fields, and simulate input events for autofill upon user request.
4. **Host Permissions (`https://ttdevasthanams.ap.gov.in/*`, `https://tirupatibalaji.ap.gov.in/*`)**: Strictly scoped to authentic TTD domains so the extension never runs on unrelated websites.
