// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Homam Specific Booking Validator
// Enforces strict Phase 3 rules for Sri Srinivasa Divyanugraha Homam:
// - Exactly 2 pilgrims available (couple or any 2 individuals)
// - Booking-level Gothram is required
// - Booking-level Email, City, State, Country, Pincode are required
// - Mobile is NOT required
// - Individual devotee details (Name, Age, Gender, ID Proof, ID Number)
// - Explicit missing fields reporting (never generic "Profile incomplete")
// ─────────────────────────────────────────────────────────────

import type { Profile, Pilgrim } from '@shared/types';
import { validateAadhaar } from './aadhaar';
import { validateAge } from './age';

export interface HomamValidationResult {
  isValid: boolean;
  missingFields: string[];
  summary: string;
  ticketPrice: number;
  pilgrimCount: number;
}

/**
 * Validate booking requirements for Sri Srinivasa Divyanugraha Homam.
 */
export function validateHomamBooking(
  profile: Profile | null | undefined,
  selectedPilgrims?: Pilgrim[],
): HomamValidationResult {
  const missingFields: string[] = [];
  const ticketPrice = 1600;

  if (!profile) {
    return {
      isValid: false,
      missingFields: ['Profile selection required'],
      summary: 'BOOKING NOT READY\n\nMissing:\n• Profile selection required',
      ticketPrice,
      pilgrimCount: 0,
    };
  }

  // 1. General Details validation (Booking level)
  const general = profile.general;
  const gothram = (general?.gothram || '').trim();
  const email = (general?.email || '').trim();
  const city = (general?.city || '').trim();
  const state = (general?.state || '').trim();
  const country = (general?.country || '').trim();
  const pinCode = (general?.pinCode || (general as any)?.pincode || '').replace(/\D/g, '');

  if (!gothram) {
    missingFields.push('Gothram');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    missingFields.push('Email Address');
  }
  if (!city) {
    missingFields.push('City');
  }
  if (!state) {
    missingFields.push('State');
  }
  if (!country) {
    missingFields.push('Country');
  }
  if (!pinCode || pinCode.length !== 6) {
    missingFields.push('Pincode (6 digits)');
  }
  // Note: mobile is NOT validated or required for Homam.

  // 2. Exactly 2 pilgrims validation
  const pilgrims = selectedPilgrims ?? (
    profile.selectedPilgrims?.['sri-srinivasa-divyanugraha-homam']
      ? profile.pilgrims.filter(p => profile.selectedPilgrims!['sri-srinivasa-divyanugraha-homam'].includes(p.id))
      : profile.pilgrims.slice(0, 2)
  );

  const pilgrimCount = pilgrims.length;
  if (pilgrimCount !== 2) {
    missingFields.push(`Exactly 2 pilgrims required (found ${pilgrimCount})`);
  }

  // 3. Devotee records validation (Pilgrim 1 and Pilgrim 2)
  for (let i = 0; i < Math.min(2, pilgrims.length); i++) {
    const p = pilgrims[i];
    const prefix = `Pilgrim ${i + 1}`;

    // Name
    const name = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim();
    if (!name) {
      missingFields.push(`${prefix} Name`);
    }

    // Age
    if (typeof p.age !== 'number' || p.age <= 0) {
      missingFields.push(`${prefix} Age`);
    } else {
      const ageVal = validateAge(p.age, p.dateOfBirth);
      if (!ageVal.valid) {
        missingFields.push(`${prefix} Age`);
      }
    }

    // Gender
    if (!p.gender || !['Male', 'Female', 'Other', 'MALE', 'FEMALE', 'OTHER'].includes(p.gender)) {
      missingFields.push(`${prefix} Gender`);
    }

    // Photo ID Proof
    if (!p.idType) {
      missingFields.push(`${prefix} Photo ID Proof`);
    }

    // Photo ID Number
    const idNum = String(p.idNumber || '').trim();
    if (!idNum) {
      missingFields.push(`${prefix} Photo ID Number`);
    } else {
      const isAadhaar = p.idType?.toLowerCase().includes('aadhaar') || idNum.replace(/\D/g, '').length === 12;
      if (isAadhaar) {
        const aadhRes = validateAadhaar(idNum);
        if (!aadhRes.valid) {
          missingFields.push(`${prefix} Photo ID Number (Valid 12-digit Aadhaar required)`);
        }
      } else if (idNum.length < 4) {
        missingFields.push(`${prefix} Photo ID Number`);
      }
    }
  }

  if (pilgrimCount < 2) {
    if (pilgrimCount === 0) {
      missingFields.push('Pilgrim 1 Details');
      missingFields.push('Pilgrim 2 Details');
    } else if (pilgrimCount === 1) {
      missingFields.push('Pilgrim 2 Details');
    }
  }

  const isValid = missingFields.length === 0;
  const summary = isValid
    ? 'BOOKING READY (2 devotees, ₹1600)'
    : `BOOKING NOT READY\n\nMissing:\n${missingFields.map(f => `• ${f}`).join('\n')}`;

  return {
    isValid,
    missingFields,
    summary,
    ticketPrice,
    pilgrimCount,
  };
}
