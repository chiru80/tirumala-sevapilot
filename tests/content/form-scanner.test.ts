// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { scanForm } from '../../src/content/form-scanner';

describe('Form Scanner DOM Analysis', () => {
  it('should detect input fields with labels and ids', () => {
    document.body.innerHTML = `
      <form id="bookingForm">
        <div>
          <label for="pilgrimName">Pilgrim Name</label>
          <input type="text" id="pilgrimName" name="name" placeholder="Enter Full Name" required />
        </div>
        <div>
          <label for="mobileNo">Mobile Number</label>
          <input type="tel" id="mobileNo" name="mobile" placeholder="10-digit mobile" />
        </div>
        <div>
          <label for="aadhaar">Aadhaar Card No</label>
          <input type="text" id="aadhaar" name="aadhaar" placeholder="12 digit Aadhaar" />
        </div>
      </form>
    `;

    const scanned = scanForm(document);
    expect(scanned.length).toBe(3);

    const nameField = scanned.find(f => f.name === 'name' || f.id === 'pilgrimName');
    expect(nameField).toBeDefined();
    expect(nameField?.label).toContain('Pilgrim Name');
    expect(nameField?.placeholder).toBe('Enter Full Name');
    expect(nameField?.required).toBe(true);
  });

  it('should ignore hidden CSRF and submit buttons', () => {
    document.body.innerHTML = `
      <form>
        <input type="hidden" name="__csrf_token" value="abc123xyz" />
        <input type="text" name="pilgrimAge" placeholder="Age" />
        <button type="submit">Continue to Payment</button>
      </form>
    `;

    const scanned = scanForm(document);
    expect(scanned.length).toBe(1);
    expect(scanned[0].name).toBe('pilgrimAge');
  });

  it('should accurately group multi-row pilgrim details like TTD Sri PAT workflow', () => {
    let rowsHtml = '';
    for (let i = 0; i < 6; i++) {
      rowsHtml += `
        <div class="row pilgrim-row">
          <div><label>Name *</label><input type="text" name="pilgrim[${i}].name" /></div>
          <div><label>Age *</label><input type="number" name="pilgrim[${i}].age" /></div>
          <div>
            <label>Gender *</label>
            <select name="pilgrim[${i}].gender">
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label>Photo ID Proof *</label>
            <select name="pilgrim[${i}].idType">
              <option value="">Select</option>
              <option value="Aadhaar Card">Aadhaar Card</option>
            </select>
          </div>
          <div><label>Photo Id Number *</label><input type="text" name="pilgrim[${i}].idNumber" /></div>
        </div>
      `;
    }

    document.body.innerHTML = `
      <div class="pilgrim-details-container">
        <h3>Pilgrim Details</h3>
        ${rowsHtml}
      </div>
    `;

    const scanned = scanForm(document);
    expect(scanned.length).toBe(30); // 6 rows * 5 fields

    // Verify groupIndex 0 to 5 are assigned
    const groups = scanned.map(f => f.groupIndex);
    const uniqueGroups = Array.from(new Set(groups));
    expect(uniqueGroups).toEqual([0, 1, 2, 3, 4, 5]);

    // Verify first row
    const row0 = scanned.filter(f => f.groupIndex === 0);
    expect(row0.length).toBe(5);
    expect(row0[0].label).toContain('Name');
    expect(row0[1].label).toContain('Age');
    expect(row0[2].label).toContain('Gender');
    expect(row0[3].label).toContain('Photo ID Proof');
    expect(row0[4].label).toContain('Photo Id Number');

    // Verify last row
    const row5 = scanned.filter(f => f.groupIndex === 5);
    expect(row5.length).toBe(5);
  });
});
