// @vitest-environment jsdom
/**
 * Phase 17 — TTD Policy Compliance Gate (release-blocking regression suite)
 *
 * Mandatory rules enforced here:
 *  - Services with unconfirmed autofill permission must FAIL CLOSED.
 *  - Srivani booking must remain manual-only on every entry path.
 *  - No field may be written before the automation authorization gate passes.
 *
 * These tests deliberately exercise the entry paths that bypass the side-panel
 * UI (the `autofill-page` keyboard command and raw FILL_FIELDS messages), because
 * they reach the content-script engine with no service id attached.
 */
import { describe, it, expect } from 'vitest';
import { executeAutofill, repairFailedFields } from '../../src/content/autofill/autofill-manager';
import { SPECIAL_ENTRY_DARSHAN_300 } from '../../src/services/workflows/special-entry-300';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

const pilgrim: Pilgrim = {
  id: 'p1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  fullName: 'Ravi Kumar',
  age: 35,
  gender: Gender.MALE,
  idType: IdType.AADHAAR,
  idNumber: '123456789012',
  country: 'India',
  createdAt: new Date().toISOString(),
};

const profile: Profile = {
  id: 'prof1',
  name: 'Test Profile',
  pilgrims: [pilgrim],
  selectedPilgrims: {},
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Builds a realistic TTD-style pilgrim-details form on the given document. */
function buildPilgrimForm(doc: Document): void {
  doc.body.innerHTML = '';
  const container = doc.createElement('div');
  container.className = 'mat-table ttd-pilgrim-container';
  const row = doc.createElement('div');
  row.className = 'mat-row pilgrim-row';
  row.id = 'devotee-row-0';
  row.innerHTML = `
    <input name="pilgrimName_0" formcontrolname="name" placeholder="Pilgrim Name" value="" />
    <input name="age_0" formcontrolname="age" placeholder="Age" type="number" value="" />
    <select name="gender_0" formcontrolname="gender">
      <option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option>
    </select>
    <select name="photoIdProof_0" formcontrolname="photoIdProof">
      <option value="">Select ID</option><option value="Aadhaar">Aadhaar</option>
    </select>
    <input name="idNumber_0" formcontrolname="idNumber" placeholder="ID Number" value="" />
  `;
  container.appendChild(row);
  doc.body.appendChild(container);
}

function writtenValues(doc: Document): string[] {
  const fields = ['pilgrimName_0', 'age_0', 'gender_0', 'photoIdProof_0', 'idNumber_0'];
  return fields.map(name => {
    const el = doc.querySelector<HTMLElement>(`[name="${name}"]`);
    return (el as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  });
}

describe('Phase 17 — TTD Policy Compliance Gate (release-blocking)', () => {
  it('FAILS CLOSED: unrecognized TTD service with no service id writes zero fields', async () => {
    const doc = document.implementation.createHTMLDocument('Unknown TTD Service');
    buildPilgrimForm(doc);

    const result = await executeAutofill({
      pilgrims: [pilgrim],
      profile,
      doc,
      url: 'https://ttdevasthanams.ap.gov.in/brand-new-seva/booking',
      // No serviceId and no workflow — exactly what the `autofill-page`
      // keyboard command and a bare FILL_FIELDS message deliver.
    } as any);

    expect(result.success).toBe(false);
    expect(result.state).toBe('ERROR');
    expect(result.errors.join(' ')).toMatch(/not authorized for autofill/i);

    // The hard guarantee: not a single field may have been written.
    expect(writtenValues(doc).every(v => v === '')).toBe(true);
  });

  it('FAILS CLOSED: same guarantee when the page URL itself is unknown but host-matched', async () => {
    const doc = document.implementation.createHTMLDocument('Another TTD Service');
    buildPilgrimForm(doc);

    const result = await executeAutofill({
      pilgrims: [pilgrim],
      profile,
      doc,
      url: 'https://tirupatibalaji.ap.gov.in/some-future-quota/entry',
    } as any);

    expect(result.state).toBe('ERROR');
    expect(result.errors.join(' ')).toMatch(/not authorized for autofill/i);
    expect(writtenValues(doc).every(v => v === '')).toBe(true);
  });

  it('Srivani stays manual-only on the keyboard-command path (URL only, no service id)', async () => {
    const doc = document.implementation.createHTMLDocument('Srivani Trust');
    buildPilgrimForm(doc);

    const result = await executeAutofill({
      pilgrims: [pilgrim],
      profile,
      doc,
      url: 'https://ttdevasthanams.ap.gov.in/srivani-trust/booking',
    } as any);

    expect(result.success).toBe(false);
    expect(result.state).toBe('ERROR');
    expect(result.errors.join(' ')).toMatch(/prohibited for Srivani/i);
    expect(writtenValues(doc).every(v => v === '')).toBe(true);
  });

  it('FAILS CLOSED: field repair is a fill path and must also refuse unconfirmed services', async () => {
    const doc = document.implementation.createHTMLDocument('Unknown Repair Target');
    buildPilgrimForm(doc);

    const result = await repairFailedFields({
      pilgrims: [pilgrim],
      profile,
      doc,
      targetFailedItems: [{ pilgrimIndex: 0, field: 'photoIdNumber' }],
      // In the extension the page URL comes from `document.location.href` and
      // the service id from `payload.serviceId || recognition.serviceId`.
      // On an unrecognised page recognition yields nothing, so this mirrors the
      // real values the content script supplies.
      url: 'https://ttdevasthanams.ap.gov.in/unknown-quota/repair',
    } as any);

    expect(result.state).toBe('ERROR');
    expect(result.errors.join(' ')).toMatch(/not authorized for autofill/i);
    expect(writtenValues(doc).every(v => v === '')).toBe(true);
  });

  it('POSITIVE CONTROL: an explicitly authorized service is not blocked by the gate', async () => {
    const doc = document.implementation.createHTMLDocument('Special Entry Darshan');
    buildPilgrimForm(doc);

    const result = await executeAutofill({
      pilgrims: [pilgrim],
      profile,
      doc,
      url: 'https://ttdevasthanams.ap.gov.in/sed/entry',
      serviceId: 'special-entry-darshan-300',
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    } as any);

    // The gate must stay silent for PERMITTED_USER_INITIATED services.
    expect(result.errors.join(' ')).not.toMatch(/not authorized for autofill/i);
    expect(result.errors.join(' ')).not.toMatch(/prohibited for Srivani/i);
  });
});
