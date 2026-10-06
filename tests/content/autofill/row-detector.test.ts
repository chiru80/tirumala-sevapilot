// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { detectAndLockPilgrimRows, isRowValidInDOM, reDetectRow } from '../../../src/content/autofill/row-detector';

describe('Row Detector (V1 Pilgrim Rows)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  function createPilgrimRowHtml(index: number): string {
    return `
      <div class="card devotee-card" id="devotee-card-${index}">
        <div class="card-header">Pilgrim ${index + 1}</div>
        <div class="card-body">
          <div class="row">
            <div class="form-group col-md-3">
              <label for="name_${index}">Name *</label>
              <input id="name_${index}" name="name_${index}" formcontrolname="name" class="form-control" type="text" />
            </div>
            <div class="form-group col-md-2">
              <label for="age_${index}">Age *</label>
              <input id="age_${index}" name="age_${index}" formcontrolname="age" class="form-control" type="number" />
            </div>
            <div class="form-group col-md-2">
              <label for="gender_${index}">Gender *</label>
              <select id="gender_${index}" formcontrolname="gender" class="form-control">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div class="form-group col-md-2">
              <label for="idType_${index}">Photo ID Proof *</label>
              <select id="idType_${index}" formcontrolname="idProof" class="form-control">
                <option value="">Select ID Proof</option>
                <option value="Aadhaar Card">Aadhaar Card</option>
                <option value="Passport">Passport</option>
              </select>
            </div>
            <div class="form-group col-md-3">
              <label for="idNum_${index}">Photo ID Number *</label>
              <input id="idNum_${index}" name="idNum_${index}" formcontrolname="idNumber" class="form-control" type="text" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 1 to 6 pilgrims test suite
  it('detects and locks exactly 1 pilgrim row', () => {
    doc.body.innerHTML = `<div class="container">${createPilgrimRowHtml(0)}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(0);
    expect(rows[0].isLocked).toBe(true);
    expect(rows[0].confidence).toBeGreaterThanOrEqual(60);
  });

  it('detects and locks exactly 2 pilgrim rows', () => {
    doc.body.innerHTML = `<div class="container">${createPilgrimRowHtml(0)}${createPilgrimRowHtml(1)}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].index).toBe(0);
    expect(rows[1].index).toBe(1);
    expect(rows[0].element).not.toBe(rows[1].element);
  });

  it('detects and locks exactly 3 pilgrim rows', () => {
    doc.body.innerHTML = `<div class="container">${[0, 1, 2].map(createPilgrimRowHtml).join('')}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 3);
    expect(rows).toHaveLength(3);
  });

  it('detects and locks exactly 4 pilgrim rows', () => {
    doc.body.innerHTML = `<div class="container">${[0, 1, 2, 3].map(createPilgrimRowHtml).join('')}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 4);
    expect(rows).toHaveLength(4);
  });

  it('detects and locks exactly 5 pilgrim rows', () => {
    doc.body.innerHTML = `<div class="container">${[0, 1, 2, 3, 4].map(createPilgrimRowHtml).join('')}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 5);
    expect(rows).toHaveLength(5);
  });

  it('detects and locks exactly 6 pilgrim rows (maximum V1 supported)', () => {
    doc.body.innerHTML = `<div class="container">${[0, 1, 2, 3, 4, 5].map(createPilgrimRowHtml).join('')}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 6);
    expect(rows).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(rows[i].index).toBe(i);
      expect(rows[i].isLocked).toBe(true);
    }
  });

  it('walks ancestor containers and picks the smallest complete container', () => {
    doc.body.innerHTML = `
      <div id="grandparent" class="main-page-wrapper">
        <div id="parent-container" class="card devotee-box">
          <div id="row-inner" class="row">
            <div class="col"><input formcontrolname="name" placeholder="Name" /></div>
            <div class="col"><input formcontrolname="age" type="number" placeholder="Age" /></div>
            <div class="col"><select formcontrolname="gender"><option>Male</option></select></div>
            <div class="col"><select formcontrolname="idProof"><option>Aadhaar</option></select></div>
            <div class="col"><input formcontrolname="idNumber" placeholder="ID Number" /></div>
          </div>
        </div>
      </div>
    `;
    const rows = detectAndLockPilgrimRows(doc, 1);
    expect(rows).toHaveLength(1);
    // Should NOT select document.body or the whole outer page wrapper
    expect(rows[0].element.id).not.toBe('grandparent');
    expect(rows[0].element.contains(doc.querySelector('input[formcontrolname="name"]'))).toBe(true);
  });

  it('rejects containers containing multiple Name fields to prevent row collapse', () => {
    doc.body.innerHTML = `
      <div id="wrapper-with-all">
        <div id="row-0" class="card">${createPilgrimRowHtml(0)}</div>
        <div id="row-1" class="card">${createPilgrimRowHtml(1)}</div>
      </div>
    `;
    const rows = detectAndLockPilgrimRows(doc, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].element.contains(doc.getElementById('name_0')!)).toBe(true);
    expect(rows[1].element.contains(doc.getElementById('name_1')!)).toBe(true);
    expect(rows[0].element.contains(rows[1].element)).toBe(false);
  });

  it('rejects unrelated containers like login or header forms', () => {
    doc.body.innerHTML = `
      <header>
        <div class="search-box">
          <input name="search" placeholder="Search..." />
        </div>
        <div class="login-box">
          <input name="username" placeholder="User Name" />
        </div>
      </header>
      <main>
        ${createPilgrimRowHtml(0)}
      </main>
    `;
    const rows = detectAndLockPilgrimRows(doc, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].element.closest('header')).toBeNull();
    expect(rows[0].element.contains(doc.getElementById('name_0')!)).toBe(true);
  });

  it('prevents overlapping rows', () => {
    doc.body.innerHTML = `
      <div class="container">
        ${[0, 1, 2].map(createPilgrimRowHtml).join('')}
      </div>
    `;
    const rows = detectAndLockPilgrimRows(doc, 3);
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows.length; j++) {
        if (i !== j) {
          expect(rows[i].element.contains(rows[j].element)).toBe(false);
          expect(rows[j].element.contains(rows[i].element)).toBe(false);
        }
      }
    }
  });

  it('sorts rows strictly by DOM order', () => {
    doc.body.innerHTML = `
      <div class="container">
        <div id="first-row">${createPilgrimRowHtml(0)}</div>
        <div id="second-row">${createPilgrimRowHtml(1)}</div>
      </div>
    `;
    const rows = detectAndLockPilgrimRows(doc, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].element.contains(doc.getElementById('name_0')!)).toBe(true);
    expect(rows[1].element.contains(doc.getElementById('name_1')!)).toBe(true);
    const pos = rows[0].element.compareDocumentPosition(rows[1].element);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('detects when a row is detached from the DOM (isRowValidInDOM)', () => {
    doc.body.innerHTML = `<div class="container">${createPilgrimRowHtml(0)}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 1);
    expect(isRowValidInDOM(rows[0], doc)).toBe(true);

    // Simulate SPA re-render
    rows[0].element.remove();
    expect(isRowValidInDOM(rows[0], doc)).toBe(false);
  });

  it('re-detects row after DOM re-render with reDetectRow', () => {
    doc.body.innerHTML = `<div class="container">${createPilgrimRowHtml(0)}</div>`;
    const rows = detectAndLockPilgrimRows(doc, 1);
    expect(isRowValidInDOM(rows[0], doc)).toBe(true);

    // Re-render
    doc.body.innerHTML = `<div class="container-rerendered">${createPilgrimRowHtml(0)}</div>`;
    expect(isRowValidInDOM(rows[0], doc)).toBe(false);

    const redetected = reDetectRow(doc, 1, 0);
    expect(redetected).not.toBeNull();
    expect(isRowValidInDOM(redetected!, doc)).toBe(true);
  });

  it('preserves smaller specific row and discards containing ancestor when both are candidates', () => {
    doc.body.innerHTML = `
      <div id="outer-table-body" class="table-container">
        <div id="specific-row-0" class="devotee-card">
          <input formcontrolname="name" id="p0_name" />
          <input formcontrolname="age" type="number" id="p0_age" />
          <select formcontrolname="gender" id="p0_gender"><option>Male</option></select>
          <select formcontrolname="idProof" id="p0_idProof"><option>Aadhaar</option></select>
          <input formcontrolname="idNumber" id="p0_idNumber" />
        </div>
      </div>
    `;
    const rows = detectAndLockPilgrimRows(doc, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].element.id).toBe('specific-row-0');
    expect(rows[0].element.id).not.toBe('outer-table-body');
  });
});
