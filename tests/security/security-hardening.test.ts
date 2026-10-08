// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSafeNavigationUrl } from '../../src/security/url-security';
import { validateDevoteePhotoFile, isValidImageDataUri, MAX_PHOTO_SIZE_BYTES } from '../../src/security/file-security';
import {
  sanitizeText,
  stripPrototypePollution,
  validateAndSanitizePilgrim,
  validateAndSanitizeProfile,
} from '../../src/security/profile-validator';
import { isForbiddenAutofillTarget } from '../../src/security/dom-security';
import { isInternalExtensionContext } from '../../src/shared/message-security';
import { logger } from '../../src/shared/logger';
import { Gender } from '../../src/shared/types';

describe('Phase 9 — Security Hardening Test Suite', () => {
  describe('1. URL Security & Protocol Defense', () => {
    it('should permit official TTD domains with HTTPS', () => {
      expect(isSafeNavigationUrl('https://ttdevasthanams.ap.gov.in')).toBe(true);
      expect(isSafeNavigationUrl('https://ttdevasthanams.ap.gov.in/booking-history')).toBe(true);
      expect(isSafeNavigationUrl('https://tirupatibalaji.ap.gov.in')).toBe(true);
      expect(isSafeNavigationUrl('https://news.tirumala.org/press-release')).toBe(true);
      expect(isSafeNavigationUrl('https://tirumala.org')).toBe(true);
      expect(isSafeNavigationUrl('https://www.tirumala.org')).toBe(true);
    });

    it('should reject dangerous pseudo-protocols', () => {
      expect(isSafeNavigationUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeNavigationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeNavigationUrl('blob:https://ttdevasthanams.ap.gov.in/uuid')).toBe(false);
      expect(isSafeNavigationUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeNavigationUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('should reject non-HTTPS URLs even on official domains', () => {
      expect(isSafeNavigationUrl('http://ttdevasthanams.ap.gov.in')).toBe(false);
    });

    it('should reject embedded user credentials in URL', () => {
      expect(isSafeNavigationUrl('https://user:pass@ttdevasthanams.ap.gov.in')).toBe(false);
    });

    it('should reject untrusted third-party domains', () => {
      expect(isSafeNavigationUrl('https://evil-ttd-phishing.com')).toBe(false);
      expect(isSafeNavigationUrl('https://google.com')).toBe(false);
    });

    it('should reject malformed or empty URLs', () => {
      expect(isSafeNavigationUrl('')).toBe(false);
      expect(isSafeNavigationUrl('   ')).toBe(false);
      expect(isSafeNavigationUrl(null as any)).toBe(false);
      expect(isSafeNavigationUrl(undefined as any)).toBe(false);
      expect(isSafeNavigationUrl('not-a-valid-url')).toBe(false);
    });
  });

  describe('2. Prototype Pollution Defense', () => {
    it('should strip __proto__, constructor, and prototype keys from untrusted objects', () => {
      const maliciousPayload = JSON.parse(
        '{"name":"Normal","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true}}',
      );

      const cleaned = stripPrototypePollution(maliciousPayload) as Record<string, unknown>;
      expect(cleaned.name).toBe('Normal');
      expect(Object.prototype.hasOwnProperty.call(cleaned, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cleaned, 'constructor')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cleaned, 'prototype')).toBe(false);
      expect(({} as any).polluted).toBeUndefined();
    });

    it('should recursively sanitize nested objects and arrays', () => {
      const complex = {
        pilgrims: [
          JSON.parse('{"firstName":"Lord","prototype":{"polluted":true}}'),
        ],
      };

      const cleaned = stripPrototypePollution(complex);
      expect(cleaned.pilgrims[0].firstName).toBe('Lord');
      expect(Object.prototype.hasOwnProperty.call(cleaned.pilgrims[0], 'prototype')).toBe(false);
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  describe('3. XSS Protection & Text Sanitization', () => {
    it('should strip HTML angle brackets and control characters', () => {
      expect(sanitizeText('<script>alert("xss")</script>Devotee')).toBe('scriptalert("xss")/scriptDevotee');
      expect(sanitizeText('<img src=x onerror=alert(1)>Govinda')).toBe('img src=x onerror=alert(1)Govinda');
      expect(sanitizeText('"><script>alert(1)</script>')).toBe('"scriptalert(1)/script');
    });

    it('should bound text length safely', () => {
      const longInput = 'A'.repeat(500);
      expect(sanitizeText(longInput, 50).length).toBe(50);
    });
  });

  describe('4. Profile Schema Validation & Corrupted Data Handling', () => {
    it('should sanitize valid pilgrim records and default invalid enums safely', () => {
      const raw = {
        id: 'p-1',
        firstName: 'Anusuri',
        lastName: 'Chirudeep',
        fullName: '<script>Anusuri Chirudeep</script>',
        gender: 'UNKNOWN_VALUE',
        age: '28',
        idType: 'AADHAAR',
        idNumber: '1234-5678-9012',
        mobile: '+91-9840123456',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
      };

      const validated = validateAndSanitizePilgrim(raw);
      expect(validated).not.toBeNull();
      expect(validated?.fullName).toBe('scriptAnusuri Chirudeep/script');
      expect(validated?.gender).toBe(Gender.MALE); // Safe fallback
      expect(validated?.age).toBe(28);
      expect(validated?.idNumber).toBe('1234-5678-9012');
      expect(validated?.mobile).toBe('919840123456');
    });

    it('should reject unrecoverable corrupted pilgrim records without crashing', () => {
      expect(validateAndSanitizePilgrim(null)).toBeNull();
      expect(validateAndSanitizePilgrim('string-instead-of-object')).toBeNull();
      expect(validateAndSanitizePilgrim({})).toBeNull(); // Missing ID
      expect(validateAndSanitizePilgrim({ id: '' })).toBeNull();
    });

    it('should validate and sanitize entire profiles, dropping corrupted pilgrims', () => {
      const rawProfile = {
        id: 'prof-valid-1',
        name: '<b>Devasthanam Trip</b>',
        isDefault: true,
        pilgrims: [
          { id: 'p-1', fullName: 'Valid Pilgrim', age: 30 },
          { invalid: 'corrupted entry' }, // Missing id
        ],
        generalDetails: {
          email: 'devotee@example.com',
          mobile: '9840123456',
        },
      };

      const profile = validateAndSanitizeProfile(rawProfile);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('bDevasthanam Trip/b');
      expect(profile?.pilgrims).toHaveLength(1);
      expect(profile?.pilgrims[0].fullName).toBe('Valid Pilgrim');
      expect(profile?.general?.email).toBe('devotee@example.com');
    });

    it('should return null for malformed profile objects', () => {
      expect(validateAndSanitizeProfile(null)).toBeNull();
      expect(validateAndSanitizeProfile([])).toBeNull();
      expect(validateAndSanitizeProfile({ id: '' })).toBeNull();
    });
  });

  describe('5. Extension Message Trust Boundaries & Sender Isolation', () => {
    beforeEach(() => {
      (globalThis as any).chrome = {
        runtime: {
          id: 'mock-extension-id',
          getURL: (path: string) => `chrome-extension://mock-extension-id/${path}`,
        },
      };
    });

    it('should identify internal extension context safely', () => {
      // Internal sidepanel / popup sender
      const internalSender: chrome.runtime.MessageSender = {
        id: 'mock-extension-id',
        url: 'chrome-extension://mock-extension-id/sidepanel.html',
      };
      expect(isInternalExtensionContext(internalSender)).toBe(true);
    });

    it('should reject content script sender originating from web page tab', () => {
      // Content script message from web page
      const contentScriptSender: chrome.runtime.MessageSender = {
        id: 'mock-extension-id',
        url: 'https://ttdevasthanams.ap.gov.in/booking',
        tab: { id: 101, url: 'https://ttdevasthanams.ap.gov.in/booking' } as chrome.tabs.Tab,
      };
      expect(isInternalExtensionContext(contentScriptSender)).toBe(false);
    });

    it('should reject external sender or wrong extension ID', () => {
      const untrustedSender: chrome.runtime.MessageSender = {
        id: 'some-other-extension-id',
      };
      expect(isInternalExtensionContext(untrustedSender)).toBe(false);
    });
  });

  describe('6. Hostile DOM & Autofill Target Defense', () => {
    it('should forbid password input fields', () => {
      const input = document.createElement('input');
      input.type = 'password';
      expect(isForbiddenAutofillTarget(input)).toBe(true);
    });

    it('should forbid hidden input fields', () => {
      const input = document.createElement('input');
      input.type = 'hidden';
      expect(isForbiddenAutofillTarget(input)).toBe(true);
    });

    it('should forbid disabled or readonly controls', () => {
      const inputDisabled = document.createElement('input');
      inputDisabled.type = 'text';
      inputDisabled.disabled = true;
      expect(isForbiddenAutofillTarget(inputDisabled)).toBe(true);

      const inputReadOnly = document.createElement('input');
      inputReadOnly.type = 'text';
      inputReadOnly.readOnly = true;
      expect(isForbiddenAutofillTarget(inputReadOnly)).toBe(true);

      const inputAriaDisabled = document.createElement('input');
      inputAriaDisabled.setAttribute('aria-disabled', 'true');
      expect(isForbiddenAutofillTarget(inputAriaDisabled)).toBe(true);
    });

    it('should forbid payment and credit card targets', () => {
      const cvvInput = document.createElement('input');
      cvvInput.setAttribute('name', 'cvv');
      expect(isForbiddenAutofillTarget(cvvInput)).toBe(true);

      const cardInput = document.createElement('input');
      cardInput.setAttribute('autocomplete', 'cc-number');
      expect(isForbiddenAutofillTarget(cardInput)).toBe(true);

      const upiInput = document.createElement('input');
      upiInput.setAttribute('id', 'upiPin');
      expect(isForbiddenAutofillTarget(upiInput)).toBe(true);
    });

    it('should forbid OTP and CAPTCHA targets', () => {
      const otpInput = document.createElement('input');
      otpInput.setAttribute('placeholder', 'Enter OTP');
      expect(isForbiddenAutofillTarget(otpInput)).toBe(true);

      const captchaInput = document.createElement('input');
      captchaInput.setAttribute('name', 'captcha');
      expect(isForbiddenAutofillTarget(captchaInput)).toBe(true);
    });

    it('should permit legitimate devotee fields', () => {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.setAttribute('name', 'pilgrimName');
      expect(isForbiddenAutofillTarget(nameInput)).toBe(false);

      const ageInput = document.createElement('input');
      ageInput.type = 'number';
      ageInput.setAttribute('name', 'age');
      expect(isForbiddenAutofillTarget(ageInput)).toBe(false);
    });
  });

  describe('7. File Upload & Data URI Security', () => {
    it('should accept valid JPEG/PNG photos under 500 KB', () => {
      const validFile = new File(['dummy-image-bytes'], 'pilgrim.jpg', { type: 'image/jpeg' });
      const result = validateDevoteePhotoFile(validFile);
      expect(result.valid).toBe(true);
    });

    it('should reject files exceeding 500 KB limit', () => {
      const oversizedBlob = new Uint8Array(MAX_PHOTO_SIZE_BYTES + 1024);
      const largeFile = new File([oversizedBlob], 'large-photo.jpg', { type: 'image/jpeg' });
      const result = validateDevoteePhotoFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    it('should reject unauthorized MIME types (executables, SVGs, scripts)', () => {
      const exeFile = new File(['binary'], 'photo.exe', { type: 'application/x-msdownload' });
      expect(validateDevoteePhotoFile(exeFile).valid).toBe(false);

      const svgFile = new File(['<svg onload="alert(1)"></svg>'], 'vector.svg', { type: 'image/svg+xml' });
      expect(validateDevoteePhotoFile(svgFile).valid).toBe(false);
    });

    it('should reject suspicious multiple extensions', () => {
      const disguisedFile = new File(['data'], 'pilgrim.exe.jpg', { type: 'image/jpeg' });
      const result = validateDevoteePhotoFile(disguisedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('multiple file extensions');
    });

    it('should validate base64 Data URIs strictly', () => {
      expect(isValidImageDataUri('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
      expect(isValidImageDataUri('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
      expect(isValidImageDataUri('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
      expect(isValidImageDataUri('data:text/html;base64,PGh0bWw+')).toBe(false);
      expect(isValidImageDataUri('javascript:alert(1)')).toBe(false);
    });
  });

  describe('8. Zero-PII Logger Redaction', () => {
    it('should redact Aadhaar numbers, phone numbers, and secrets from log messages', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Processing pilgrim Aadhaar: 1234 5678 9012 and mobile: 9840123456 with token: secret-token');

      expect(consoleSpy).toHaveBeenCalled();
      const loggedMessage = consoleSpy.mock.calls[0][1] as string;

      // Sensitive identifiers should not appear unredacted
      expect(loggedMessage).not.toContain('1234 5678 9012');
      expect(loggedMessage).not.toContain('9840123456');
      expect(loggedMessage).toContain('******9012');
      expect(loggedMessage).toContain('******56');
      expect(loggedMessage).toContain('[REDACTED]');

      consoleSpy.mockRestore();
    });

    it('should redact base64 Data URIs from logs', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Uploaded photo payload: data:image/jpeg;base64,dGVzdGFhYWFhYWFhYWFhYWFhYQ==');

      expect(consoleSpy).toHaveBeenCalled();
      const loggedMessage = consoleSpy.mock.calls[0][1] as string;
      expect(loggedMessage).toContain('[IMAGE_DATA_URI:REDACTED]');
      expect(loggedMessage).not.toContain('dGVzdGFhYWFhYWFhYWFhYWFhYQ==');

      consoleSpy.mockRestore();
    });
  });
});
