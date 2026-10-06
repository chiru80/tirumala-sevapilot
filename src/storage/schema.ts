// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Storage Schema
// ─────────────────────────────────────────────────

export const PROFILE_SCHEMA_V1 = {
  version: 1,
  description: 'Initial schema for pilgrim profiles',
  fields: {
    id: { type: 'string', required: true },
    firstName: { type: 'string', required: true },
    middleName: { type: 'string', required: false },
    lastName: { type: 'string', required: true },
    fullName: { type: 'string', required: true },
    gender: { type: 'enum', values: ['Male', 'Female', 'Other'], required: true },
    dateOfBirth: { type: 'string', format: 'date', required: true },
    age: { type: 'number', required: false },
    idType: { type: 'enum', values: ['Aadhaar', 'Passport', 'Voter ID', 'PAN', 'Driving License', 'Ration Card'], required: true },
    idNumber: { type: 'string', required: true },
    mobile: { type: 'string', required: false },
    email: { type: 'string', required: false },
    address: { type: 'string', required: false },
    city: { type: 'string', required: false },
    district: { type: 'string', required: false },
    state: { type: 'string', required: false },
    country: { type: 'string', required: false },
    pinCode: { type: 'string', required: false },
    photo: { type: 'string', required: false },
    passportNumber: { type: 'string', required: false },
    passportExpiry: { type: 'string', required: false },
    visaNumber: { type: 'string', required: false },
    visaExpiry: { type: 'string', required: false },
    notes: { type: 'string', required: false },
  },
} as const;

/** Schema version registry */
export const SCHEMAS = {
  1: PROFILE_SCHEMA_V1,
} as const;
