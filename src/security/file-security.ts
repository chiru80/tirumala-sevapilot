// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — File & Image Security Validator (Phase 9)
// Enforces MIME type, extension, size, and data URI safety.
// ─────────────────────────────────────────────────────────────

import logger from '@shared/logger';

/** Maximum photo size permitted for devotee attachments (500 KB) */
export const MAX_PHOTO_SIZE_BYTES = 500 * 1024;

/** Allowed MIME types for devotee photographs */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/** Allowed file extensions */
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
}

/**
 * Validates a user-selected File before reading it into base64 or memory.
 */
export function validateDevoteePhotoFile(file: File | null | undefined): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // 1. File size check
  if (file.size <= 0) {
    return { valid: false, error: 'File is empty' };
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return {
      valid: false,
      error: `Photo exceeds maximum allowed size of 500 KB (current size: ${(file.size / 1024).toFixed(1)} KB)`,
    };
  }

  // 2. MIME type check
  const mimeType = (file.type || '').toLowerCase();
  const isMimeAllowed = ALLOWED_IMAGE_MIME_TYPES.some(m => m === mimeType);
  if (!isMimeAllowed) {
    logger.warn('[FileSecurity] Rejected file with unauthorized MIME type:', mimeType);
    return {
      valid: false,
      error: 'Invalid image format. Only JPG and PNG files are accepted.',
    };
  }

  // 3. Reject suspicious multiple or executable extensions (e.g. photo.jpg.exe, photo.exe.jpg)
  const fileName = file.name || '';
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dotCount = (sanitizedName.match(/\./g) || []).length;
  if (dotCount > 1) {
    const parts = sanitizedName.split('.').slice(1);
    const DANGEROUS_EXTS = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'scr', 'bin', 'com', 'msi', 'jar', 'py', 'pl'];
    const hasDangerousPart = parts.some(part => DANGEROUS_EXTS.includes(part.toLowerCase()));
    if (hasDangerousPart || dotCount > 2) {
      logger.warn('[FileSecurity] Rejected file with suspicious multiple extensions:', fileName);
      return { valid: false, error: 'Suspicious multiple file extensions detected.' };
    }
  }

  // 4. Extension check
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  const isExtAllowed = ALLOWED_IMAGE_EXTENSIONS.some(e => e === ext);
  if (!isExtAllowed) {
    logger.warn('[FileSecurity] Rejected file with unauthorized extension:', ext);
    return {
      valid: false,
      error: 'Invalid file extension. Only .jpg, .jpeg, and .png are allowed.',
    };
  }

  return { valid: true, sanitizedName };
}

/**
 * Validates that a string is a safe, valid image Data URI.
 * Rejects SVG (which can contain embedded script), HTML, or non-image data URIs.
 */
export function isValidImageDataUri(dataUri: string | null | undefined): boolean {
  if (!dataUri || typeof dataUri !== 'string') return false;

  const trimmed = dataUri.trim();
  // Strictly enforce JPEG or PNG base64 data URI format
  const validPattern = /^data:image\/(?:jpeg|jpg|png);base64,[A-Za-z0-9+/=]+$/;
  if (!validPattern.test(trimmed)) {
    return false;
  }

  // Sanity check length: max 1MB in base64 string length (~750KB payload)
  if (trimmed.length > 1024 * 1024) {
    return false;
  }

  return true;
}
