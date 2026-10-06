// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Field Mapper with Confidence Scoring
// ─────────────────────────────────────────────────

import { FIELD_ALIASES, getConfidenceLevel } from '@shared/constants';
import { normalizeText } from '@shared/utils';
import type { ScannedField, FieldMapping, Pilgrim } from '@shared/types';

/**
 * Map scanned fields to pilgrim data keys with confidence scores.
 * Uses multi-signal matching: name, id, label, placeholder, aria-label, autocomplete.
 */
export function mapFields(scannedFields: ScannedField[]): FieldMapping[] {
  return scannedFields
    .map(field => mapSingleField(field))
    .filter((mapping): mapping is FieldMapping => mapping !== null);
}

function mapSingleField(field: ScannedField): FieldMapping | null {
  let bestKey: keyof Pilgrim | null = null;
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    const { score, reasons } = computeMatchScore(field, aliases);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key as keyof Pilgrim;
      bestReasons = reasons;
    }
  }

  // Also check autocomplete attribute (standard hint)
  const autoScore = matchAutocomplete(field);
  if (autoScore.score > bestScore) {
    bestScore = autoScore.score;
    bestKey = autoScore.key;
    bestReasons = autoScore.reasons;
  }

  // Contextual Disambiguation for Government / TTD Forms:
  const textSignals = [
    field.label,
    field.name,
    field.id,
    field.placeholder,
    field.ariaLabel,
  ].filter(Boolean).map(s => normalizeText(s!));

  const hasNumberSignal = textSignals.some(s =>
    s.includes('number') || s.includes('no') || s.includes('num') || s.includes('digit')
  );

  const hasIdSignal = textSignals.some(s =>
    s.includes('id') || s.includes('proof') || s.includes('aadhaar') || s.includes('aadhar') || s.includes('identity')
  );

  // If a field asks for an ID number, never allow it to be classified as idType
  if (hasIdSignal && hasNumberSignal) {
    bestKey = 'idNumber';
    bestScore = Math.max(bestScore, 90);
    bestReasons.push('ID Number disambiguation applied');
  } else if (hasIdSignal && (field.type === 'select' || textSignals.some(s => s.includes('proof') || s.includes('type')))) {
    // If it's a dropdown or mentions proof/type without number, it's idType
    if (!hasNumberSignal) {
      bestKey = 'idType';
      bestScore = Math.max(bestScore, 90);
      bestReasons.push('ID Proof/Type dropdown disambiguation applied');
    }
  }

  if (bestKey && bestScore >= 20) {
    return {
      scannedField: field,
      pilgrimKey: bestKey,
      confidence: Math.min(bestScore, 100),
      confidenceLevel: getConfidenceLevel(Math.min(bestScore, 100)),
      matchReasons: bestReasons,
    };
  }

  // Return unmapped
  return {
    scannedField: field,
    pilgrimKey: null,
    confidence: 0,
    confidenceLevel: getConfidenceLevel(0),
    matchReasons: ['No matching pilgrim field found'],
  };
}

/**
 * Compute match score for a field against a set of aliases.
 * Multiple signals are combined with different weights.
 */
function computeMatchScore(
  field: ScannedField,
  aliases: string[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const normalizedAliases = aliases.map(a => normalizeText(a));

  // Signal 1: name attribute (weight: 40)
  if (field.name) {
    const normalizedName = normalizeText(field.name);
    for (const alias of normalizedAliases) {
      if (normalizedName === alias) {
        score += 40;
        reasons.push(`Exact name match: "${field.name}"`);
        break;
      }
      if (normalizedName.includes(alias) || alias.includes(normalizedName)) {
        score += 30;
        reasons.push(`Partial name match: "${field.name}"`);
        break;
      }
    }
  }

  // Signal 2: id attribute (weight: 35)
  if (field.id) {
    const normalizedId = normalizeText(field.id);
    for (const alias of normalizedAliases) {
      if (normalizedId === alias || normalizedId.includes(alias)) {
        score += 35;
        reasons.push(`ID match: "${field.id}"`);
        break;
      }
    }
  }

  // Signal 3: label text (weight: 30)
  if (field.label) {
    const normalizedLabel = normalizeText(field.label);
    for (const alias of normalizedAliases) {
      if (normalizedLabel === alias) {
        score += 30;
        reasons.push(`Exact label match: "${field.label}"`);
        break;
      }
      if (normalizedLabel.includes(alias) || alias.includes(normalizedLabel)) {
        score += 20;
        reasons.push(`Partial label match: "${field.label}"`);
        break;
      }
    }
  }

  // Signal 4: placeholder (weight: 20)
  if (field.placeholder) {
    const normalizedPH = normalizeText(field.placeholder);
    for (const alias of normalizedAliases) {
      if (normalizedPH.includes(alias)) {
        score += 20;
        reasons.push(`Placeholder match: "${field.placeholder}"`);
        break;
      }
    }
  }

  // Signal 5: aria-label (weight: 25)
  if (field.ariaLabel) {
    const normalizedAria = normalizeText(field.ariaLabel);
    for (const alias of normalizedAliases) {
      if (normalizedAria.includes(alias)) {
        score += 25;
        reasons.push(`Aria-label match: "${field.ariaLabel}"`);
        break;
      }
    }
  }

  return { score, reasons };
}

/** Match against standard autocomplete values */
function matchAutocomplete(
  field: ScannedField,
): { score: number; key: keyof Pilgrim | null; reasons: string[] } {
  if (!field.autocomplete) return { score: 0, key: null, reasons: [] };

  const autoMap: Record<string, keyof Pilgrim> = {
    'name': 'fullName',
    'given-name': 'firstName',
    'family-name': 'lastName',
    'additional-name': 'middleName',
    'email': 'email',
    'tel': 'mobile',
    'tel-national': 'mobile',
    'street-address': 'address',
    'address-line1': 'address',
    'address-level2': 'city',
    'address-level1': 'state',
    'country': 'country',
    'country-name': 'country',
    'postal-code': 'pinCode',
    'bday': 'dateOfBirth',
    'sex': 'gender',
  };

  const key = autoMap[field.autocomplete.toLowerCase()];
  if (key) {
    return {
      score: 45,
      key,
      reasons: [`Autocomplete attribute: "${field.autocomplete}"`],
    };
  }

  return { score: 0, key: null, reasons: [] };
}
