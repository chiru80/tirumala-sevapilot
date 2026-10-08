// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 9 Security Hardening Test Suite
// Verifies file validation, URL origin gating, DOM input defense,
// prototype pollution protection, message boundaries, and PII masking.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  validateDevoteePhotoFile,
  isValidImageDataUri,
  MAX_PHOTO_SIZE_BYTES,
} from '../../src/security/file-security';
import {
  isSafeNavigationUrl,
  ALLOWED_NAVIGATION_ORIGINS,
} from '../../src/security/url-security';
import {
  isForbiddenAutofillTarget,
  isElementStrictlyInteractive,
} from '../../src/security/dom-security';
import {
  isInternalExtensionContext,
} from '../../src/shared/message-security';
import {
  validateAndSanitizeProfile,
  validateAndSanitizePilgrim,
  sanitizeText,
  stripPrototypePollution,
} from '../../src/security/profile-validator';
import { logger } from '../../src/shared/logger';
import { Gender, IdType } from '../../src/shared/types';

describe('Phase 9 — Security Hardening Audit & Defense Suite', () => {

  // ─── 1. File & Attachment Security ───
  describe('1. Devotee Photo & File Attachment Security', () => {
    it('accepts valid JPEG and PNG files under 500 KB', () => {
      const validJpg = new File(['fake-jpg-content'], 'devotee.jpg', { type: 'image/jpeg' });
      const resJpg = validateDevoteePhotoFile(validJpg);
      expect(resJpg.valid).toBe(true);
      expect(resJpg.sanitizedName).toBe('devotee.jpg');

      const validPng = new File(['fake-png-content'], 'devotee.png', { type: 'image/png' });
      const resPng = validateDevoteePhotoFile(validPng);
      expect(resPng.valid).toBe(true);
    });

    it('rejects files exceeding 500 KB limit', () => {
      const largeContent = new Uint8Array(MAX_PHOTO_SIZE_BYTES + 1024);
      const largeFile = new File([largeContent], 'heavy.jpg', { type: 'image/jpeg' });
      const res = validateDevoteePhotoFile(largeFile);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds maximum allowed size of 500 KB');
    });

    it('rejects empty (0 byte) files', () => {
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
      const res = validateDevoteePhotoFile(emptyFile);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('File is empty');
    });

    it('rejects unauthorized MIME types (PDF, SVG, HTML, EXE)', () => {
      const pdfFile = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
      expect(validateDevoteePhotoFile(pdfFile).valid).toBe(false);

      const svgFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });
      expect(validateDevoteePhotoFile(svgFile).valid).toBe(false);

      const exeFile = new File(['binary'], 'virus.exe', { type: 'application/x-msdownload' });
      expect(validateDevoteePhotoFile(exeFile).valid).toBe(false);
    });

    it('rejects suspicious double extensions', () => {
      const doubleExt = new File(['img'], 'photo.jpg.exe', { type: 'image/jpeg' });
      const res = validateDevoteePhotoFile(doubleExt);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Suspicious multiple file extensions');
    });

    it('validates safe image Data URIs and rejects SVG / script vectors', () => {
      expect(isValidImageDataUri('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
      expect(isValidImageDataUri('data:image/png;base64,iVBORw0KGgo=')).toBe(true);

      // Reject SVG (can embed JavaScript)
      expect(isValidImageDataUri('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false);
      // Reject HTML data URI
      expect(isValidImageDataUri('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
      // Reject plain strings
      expect(isValidImageDataUri('https://example.com/pic.jpg')).toBe(false);
      expect(isValidImageDataUri('')).toBe(false);
    });
  });

  // ─── 2. Safe Navigation & Origin Gating ───
  describe('2. Safe Navigation & Origin Gating', () => {
    it('permits official TTD domains', () => {
      expect(isSafeNavigationUrl('https://ttdevasthanams.ap.gov.in')).toBe(true);
      expect(isSafeNavigationUrl('https://ttdevasthanams.ap.gov.in/special-entry-darshan-300')).toBe(true);
      expect(isSafeNavigationUrl('https://tirupatibalaji.ap.gov.in/')).toBe(true);
      expect(isSafeNavigationUrl('https://news.tirumala.org/announcements')).toBe(true);
    });

    it('rejects dangerous pseudo-protocols (javascript:, data:, vbscript:)', () => {
      expect(isSafeNavigationUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeNavigationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeNavigationUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeNavigationUrl('blob:https://ttdevasthanams.ap.gov.in/123')).toBe(false);
      expect(isSafeNavigationUrl('file:///C:/passwords.txt')).toBe(false);
    });

    it('rejects non-HTTPS and untrusted third-party domains', () => {
      expect(isSafeNavigationUrl('http://ttdevasthanams.ap.gov.in')).toBe(false);
      expect(isSafeNavigationUrl('https://fake-ttd-portal.com')).toBe(false);
      expect(isSafeNavigationUrl('https://google.com')).toBe(false);
    });

    it('rejects embedded credentials in URL', () => {
      expect(isSafeNavigationUrl('https://admin:secret@ttdevasthanams.ap.gov.in')).toBe(false);
    });
  });

  // ─── 3. DOM Security & Hostile Input Guard ───
  describe('3. DOM Security & Hostile Input Guard', () => {
    it('blocks password and hidden input fields from autofill', () => {
      const pwd = document.createElement('input');
      pwd.type = 'password';
      expect(isForbiddenAutofillTarget(pwd)).toBe(true);

      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      expect(isForbiddenAutofillTarget(hidden)).toBe(true);
    });

    it('blocks disabled and readonly controls (unless permitted combobox)', () => {
      const disabled = document.createElement('input');
      disabled.disabled = true;
      expect(isForbiddenAutofillTarget(disabled)).toBe(true);

      const readonlyInput = document.createElement('input');
      readonlyInput.readOnly = true;
      expect(isForbiddenAutofillTarget(readonlyInput)).toBe(true);

      // Permitted combobox
      const combobox = document.createElement('input');
      combobox.readOnly = true;
      combobox.setAttribute('role', 'combobox');
      expect(isForbiddenAutofillTarget(combobox, { allowComboboxReadOnly: true })).toBe(false);
    });

    it('blocks sensitive inputs matching OTP, CAPTCHA, CVV, and Payment patterns', () => {
      const otpInput = document.createElement('input');
      otpInput.name = 'mobileOtp';
      expect(isForbiddenAutofillTarget(otpInput)).toBe(true);

      const captchaInput = document.createElement('input');
      captchaInput.placeholder = 'Enter captcha code';
      expect(isForbiddenAutofillTarget(captchaInput)).toBe(true);

      const cvvInput = document.createElement('input');
      cvvInput.setAttribute('formcontrolname', 'cvvNumber');
      expect(isForbiddenAutofillTarget(cvvInput)).toBe(true);

      const cardInput = document.createElement('input');
      cardInput.setAttribute('autocomplete', 'cc-number');
      expect(isForbiddenAutofillTarget(cardInput)).toBe(true);
    });

    it('allows standard benign devotee fields', () => {
      const nameInput = document.createElement('input');
      nameInput.name = 'pilgrimName';
      nameInput.type = 'text';
      expect(isForbiddenAutofillTarget(nameInput)).toBe(false);

      const ageInput = document.createElement('input');
      ageInput.name = 'age';
      ageInput.type = 'number';
      expect(isForbiddenAutofillTarget(ageInput)).toBe(false);
    });
  });

  // ─── 4. Message Sender Isolation ───
  describe('4. Message Sender Isolation (Internal vs Content Script)', () => {
    it('recognizes internal extension contexts (sidepanel, popup, options without tab)', () => {
      const internalSender: chrome.runtime.MessageSender = {
        id: 'test-ext-id',
        url: 'chrome-extension://test-ext-id/sidepanel.html',
      };
      expect(isInternalExtensionContext(internalSender)).toBe(true);
    });

    it('blocks content script senders (which have sender.tab attached)', () => {
      const contentScriptSender: chrome.runtime.MessageSender = {
        id: 'test-ext-id',
        url: 'https://ttdevasthanams.ap.gov.in/booking',
        tab: { id: 101, index: 0, pinned: false, highlighted: false, windowId: 1, active: true, incognito: false, selected: true, discarded: false, autoDiscardable: true, frozen: false, groupId: -1, lastAccessed: Date.now() } as unknown as chrome.tabs.Tab,
      };
      expect(isInternalExtensionContext(contentScriptSender)).toBe(false);
    });
  });

  // ─── 5. Schema Validation & Prototype Pollution Defense ───
  describe('5. Schema Validation & Prototype Pollution Defense', () => {
    it('strips dangerous prototype pollution keys (__proto__, constructor, prototype)', () => {
      const maliciousObj = JSON.parse('{"name":"Safe Name","__proto__":{"polluted":"yes"},"nested":{"constructor":"evil"}}');
      const cleaned = stripPrototypePollution(maliciousObj);

      expect((cleaned as any).polluted).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(cleaned, '__proto__')).toBe(false);
      expect((cleaned as any).name).toBe('Safe Name');
    });

    it('sanitizes HTML tags from user inputs to prevent stored XSS', () => {
      expect(sanitizeText('<script>alert("xss")</script>Venkatesh')).toBe('alert("xss")Venkatesh');
      expect(sanitizeText('<b>Raman</b>', 50)).toBe('Raman');
    });

    it('validates and caps profile devotees at maximum 6', () => {
      const overpopulatedProfile = {
        id: 'prof-many',
        name: 'Big Group',
        pilgrims: Array.from({ length: 10 }, (_, i) => ({
          id: `p-${i}`,
          firstName: `Devotee ${i}`,
          gender: 'MALE',
          age: 30,
          idType: 'Aadhaar',
          idNumber: '999999990019',
        })),
        general: { city: 'Tirupati', state: 'AP', country: 'India', pinCode: '517501' },
      };

      const sanitized = validateAndSanitizeProfile(overpopulatedProfile);
      expect(sanitized).not.toBeNull();
      expect(sanitized?.pilgrims).toHaveLength(6); // Capped strictly at 6
    });
  });

  // ─── 6. Logger Sensitive Data Masking ───
  describe('6. Structured Logger PII Redaction', () => {
    it('masks Aadhaar numbers to last 4 digits in log outputs', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Processing devotee with Aadhaar 999999990019');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedStr = consoleWarnSpy.mock.calls[0][1] as string;
      expect(loggedStr).toContain('******0019');
      expect(loggedStr).not.toContain('999999990019');

      consoleWarnSpy.mockRestore();
    });

    it('masks Indian mobile numbers to last 2 digits', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Contacting mobile 9876543210');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedStr = consoleWarnSpy.mock.calls[0][1] as string;
      expect(loggedStr).toContain('******10');
      expect(loggedStr).not.toContain('9876543210');

      consoleWarnSpy.mockRestore();
    });

    it('redacts base64 image data URIs in logs', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Attached photo: data:image/jpeg;base64,/9j/4AAQSkZJRg==');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedStr = consoleWarnSpy.mock.calls[0][1] as string;
      expect(loggedStr).toContain('[IMAGE_DATA_URI:REDACTED]');
      expect(loggedStr).not.toContain('/9j/4AAQSkZJRg==');

      consoleWarnSpy.mockRestore();
    });
  });
});
