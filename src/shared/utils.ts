// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Utility Functions
// ─────────────────────────────────────────────────

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** Deep clone an object */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** Throttle a function */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/** Mask a sensitive string for preview display */
export function maskSensitiveValue(value: string, type: 'aadhaar' | 'mobile' | 'email' | 'id' | 'default' = 'default'): string {
  if (!value) return '';

  switch (type) {
    case 'aadhaar':
      // Show last 4 digits: ****-****-1234
      return value.length >= 4
        ? `****-****-${value.slice(-4)}`
        : '****';

    case 'mobile':
      // Show last 2 digits: ********12
      return value.length >= 2
        ? `${'*'.repeat(value.length - 2)}${value.slice(-2)}`
        : '****';

    case 'email':
      // Show first char + domain: c***@gmail.com
      const atIndex = value.indexOf('@');
      if (atIndex > 0) {
        return `${value[0]}${'*'.repeat(Math.max(atIndex - 1, 2))}${value.slice(atIndex)}`;
      }
      return '***@***';

    case 'id':
      // Show last 4 chars
      return value.length >= 4
        ? `${'*'.repeat(value.length - 4)}${value.slice(-4)}`
        : '****';

    default:
      // Hide middle portion
      if (value.length <= 4) return '****';
      return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
  }
}

/** Normalize text for matching: lowercase, strip punctuation/hyphens/spaces/asterisks */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_./\\()[\]{}*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if a URL belongs to a supported TTD booking domain */
export function isSupportedDomain(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:') return false;
    return hostname === 'ttdevasthanams.ap.gov.in' || hostname === 'tirupatibalaji.ap.gov.in';
  } catch {
    return false;
  }
}

/** Format a date string for display */
export function formatDate(dateStr: string, format: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'display' = 'display'): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());

    switch (format) {
      case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
      case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
      case 'display': return `${dd} ${date.toLocaleString('en', { month: 'short' })} ${yyyy}`;
      default: return dateStr;
    }
  } catch {
    return dateStr;
  }
}

/** Calculate age from DOB */
export function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Canonical helper for resolving a devotee's effective age.
 * Rules:
 * 1. Use valid age when present (1 to 125)
 * 2. Otherwise calculate from DOB (accounting for birthdays & leap years)
 * 3. Validate resulting age (0 to 125)
 * 4. Return undefined when neither is usable
 */
export function getEffectiveAge(
  pilgrim: { age?: number | string; dateOfBirth?: string } | null | undefined,
  referenceDate?: Date,
): number | undefined {
  if (!pilgrim) return undefined;

  // Rule 1: Use valid age when present
  if (typeof pilgrim.age === 'number' && Number.isInteger(pilgrim.age) && pilgrim.age >= 1 && pilgrim.age <= 125) {
    return pilgrim.age;
  }
  if (typeof pilgrim.age === 'string' && pilgrim.age.trim() !== '') {
    const parsed = parseInt(pilgrim.age.trim(), 10);
    if (!isNaN(parsed) && Number.isInteger(parsed) && parsed >= 1 && parsed <= 125) {
      return parsed;
    }
  }

  // Rule 2: Otherwise calculate from DOB
  if (pilgrim.dateOfBirth && typeof pilgrim.dateOfBirth === 'string') {
    const trimmed = pilgrim.dateOfBirth.trim();
    if (trimmed) {
      const birthDate = new Date(trimmed);
      if (!isNaN(birthDate.getTime())) {
        const today = referenceDate || new Date();
        let calculated = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculated--;
        }

        // Rule 3: Validate resulting age
        if (calculated >= 0 && calculated <= 125) {
          return calculated;
        }
      }
    }
  }

  // Rule 4: Return undefined when neither is usable
  return undefined;
}

/** Get current ISO timestamp */
export function now(): string {
  return new Date().toISOString();
}

/** ArrayBuffer to Base64 string */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Base64 string to ArrayBuffer */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Single source of truth for resolving Step 2 General Booking details.
 * Prevents mismatch between profile.general and profile root fields.
 */
export function resolveGeneralDetails(profile: any): {
  gothram: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
} {
  const g = profile?.general || {};
  const addr = profile?.address || {};
  const p0 = profile?.pilgrims?.[0] || {};

  return {
    gothram: (g.gothram || profile?.gothram || '').trim(),
    email: (g.email || profile?.email || p0.email || '').trim(),
    mobile: (g.mobile || profile?.mobile || p0.mobile || '').trim(),
    city: (g.city || addr.city || '').trim(),
    state: (g.state || addr.state || '').trim(),
    country: (g.country || addr.country || '').trim(),
    pinCode: (g.pinCode || addr.pinCode || '').trim(),
  };
}

/**
 * Centralized, strict verification for official TTD domains.
 * Rejects substring spoofs or unauthorized subdomains.
 */
export function isOfficialTTDDomain(urlOrHostname: string): boolean {
  try {
    const raw = urlOrHostname.trim();
    const hostname = raw.includes('://') ? new URL(raw).hostname.toLowerCase() : raw.toLowerCase();
    return hostname === 'ttdevasthanams.ap.gov.in' || hostname === 'tirupatibalaji.ap.gov.in';
  } catch {
    return false;
  }
}

