// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Document Intelligence
// Phase 7: Advanced Profile & Document Intelligence
// ─────────────────────────────────────────────────

export interface DocumentValidationRule {
  allowedMimeTypes: string[];
  minSizeBytes: number; // e.g. 10 KB
  maxSizeBytes: number; // e.g. 1 MB
  requirePortraitRatio?: boolean;
  minWidthPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
}

export const TTD_DEFAULT_PHOTO_RULES: DocumentValidationRule = {
  allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
  minSizeBytes: 10 * 1024, // 10 KB
  maxSizeBytes: 500 * 1024, // 500 KB
  requirePortraitRatio: true,
  minWidthPx: 100,
  maxWidthPx: 2000,
  minHeightPx: 100,
  maxHeightPx: 2000,
};

export interface DocumentValidationResult {
  valid: boolean;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a base64 encoded photo or document strictly locally.
 * Zero external calls. Zero cloud OCR. Zero telemetry.
 */
export function validateDocumentLocally(
  base64OrDataUrl: string,
  rules: DocumentValidationRule = TTD_DEFAULT_PHOTO_RULES
): DocumentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!base64OrDataUrl || base64OrDataUrl.trim().length === 0) {
    return {
      valid: false,
      errors: ['No document or photo provided'],
      warnings: [],
    };
  }

  // Parse Data URL scheme: data:[<mediatype>][;base64],<data>
  let mimeType = 'image/jpeg';
  let base64Data = base64OrDataUrl;

  const dataUrlMatch = base64OrDataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64Data = dataUrlMatch[2];
  }

  // 1. Check MIME type
  const isAllowedMime = rules.allowedMimeTypes.some((allowed) =>
    allowed.toLowerCase() === mimeType ||
    (allowed === 'image/jpeg' && mimeType === 'image/jpg') ||
    (allowed === 'image/jpg' && mimeType === 'image/jpeg')
  );

  if (!isAllowedMime) {
    errors.push(`Unsupported file format '${mimeType}'. Allowed formats: ${rules.allowedMimeTypes.join(', ')}`);
  }

  // 2. Calculate approximate binary size
  // Base64 size formula: (3/4) * length - padding
  const padding = (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
  const sizeBytes = Math.floor((base64Data.length * 3) / 4) - padding;

  if (sizeBytes < rules.minSizeBytes) {
    errors.push(`File size (${Math.round(sizeBytes / 1024)} KB) is smaller than minimum required ${Math.round(rules.minSizeBytes / 1024)} KB`);
  }

  if (sizeBytes > rules.maxSizeBytes) {
    errors.push(`File size (${Math.round(sizeBytes / 1024)} KB) exceeds maximum allowed ${Math.round(rules.maxSizeBytes / 1024)} KB`);
  }

  // Basic sanity check on base64 character set
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(base64Data.replace(/\s+/g, ''))) {
    errors.push('Document data is corrupted or not a valid base64 encoding');
  }

  return {
    valid: errors.length === 0,
    mimeType,
    sizeBytes,
    errors,
    warnings,
  };
}

/**
 * Checks image dimensions if HTML Image element is available (browser context).
 */
export async function validateImageDimensions(
  dataUrl: string,
  rules: DocumentValidationRule = TTD_DEFAULT_PHOTO_RULES
): Promise<{ width: number; height: number; aspectRatio: number; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof Image === 'undefined') {
    // Non-browser / Node test environment
    return { width: 0, height: 0, aspectRatio: 1, errors: [], warnings: [] };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const aspectRatio = width / (height || 1);

      if (rules.minWidthPx && width < rules.minWidthPx) {
        errors.push(`Image width (${width}px) is less than required ${rules.minWidthPx}px`);
      }
      if (rules.minHeightPx && height < rules.minHeightPx) {
        errors.push(`Image height (${height}px) is less than required ${rules.minHeightPx}px`);
      }

      // Check portrait aspect ratio (typically height > width or near 1:1, ratio between 0.65 and 1.15)
      if (rules.requirePortraitRatio && (aspectRatio < 0.6 || aspectRatio > 1.35)) {
        warnings.push(`Image aspect ratio (${aspectRatio.toFixed(2)}) is not a standard portrait/passport photo ratio (expected 3:4 or 1:1)`);
      }

      resolve({
        width,
        height,
        aspectRatio,
        errors,
        warnings,
      });
    };

    img.onerror = () => {
      resolve({
        width: 0,
        height: 0,
        aspectRatio: 0,
        errors: ['Failed to decode image data into valid bitmap'],
        warnings: [],
      });
    };

    img.src = dataUrl;
  });
}
