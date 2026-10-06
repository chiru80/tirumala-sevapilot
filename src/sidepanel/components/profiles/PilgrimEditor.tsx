import React, { useState } from 'react';
import { Gender, IdType } from '@shared/types';
import type { Pilgrim } from '@shared/types';

export function maskIdDisplay(val?: string): string {
  if (!val) return '—';
  const clean = val.replace(/\s+/g, '');
  if (clean.length === 12) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  if (clean.length > 4) {
    return `•••• ${clean.slice(-4)}`;
  }
  return '••••';
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Maharashtra',
  'Kerala', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh',
  'Delhi', 'Odisha', 'West Bengal', 'Bihar', 'Punjab', 'Haryana',
  'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'Goa', 'Himachal Pradesh'
];

/**
 * 5-Section Pilgrim Editor Modal
 * Sections: PERSONAL, IDENTITY, CONTACT, ADDRESS, PHOTO
 */
export function PilgrimEditorModal({
  editPilgrim,
  onClose,
  onSave,
}: {
  editPilgrim: { profileId: string; pilgrim: Pilgrim };
  onClose: () => void;
  onSave: (pilgrim: Pilgrim) => Promise<void>;
}) {
  const [pilgrim, setPilgrim] = useState<Pilgrim>({ ...editPilgrim.pilgrim });
  const [showIdPlain, setShowIdPlain] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'identity' | 'contact' | 'address' | 'photo'>('personal');

  const tabs: Array<{ id: 'personal' | 'identity' | 'contact' | 'address' | 'photo'; label: string }> = [
    { id: 'personal', label: '1. Personal' },
    { id: 'identity', label: '2. Identity' },
    { id: 'contact', label: '3. Contact' },
    { id: 'address', label: '4. Address' },
    { id: 'photo', label: '5. Photo' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-fade-in">
      <div className="bg-white dark:bg-[#2D1A38] p-4 rounded-2xl shadow-2xl w-full max-w-md border border-gold-500/30 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gold-500/15">
          <div>
            <h3 className="text-xs font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">
              Edit Devotee Details
            </h3>
            <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4]">
              {pilgrim.fullName || 'New Devotee'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold p-1">
            ✕
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-gold-500/20 gap-1 overflow-x-auto pb-1 text-2xs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'bg-gold-500/20 text-[#5B2A86] dark:text-gold-300 border border-gold-500/40'
                  : 'text-[#6B5A70] dark:text-[#A692B4] hover:bg-gold-500/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section 1: PERSONAL */}
        {activeTab === 'personal' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div>
              <label className="sp-label">Full Name *</label>
              <input
                className="sp-input text-xs"
                placeholder="Devotee name as per Photo ID"
                value={pilgrim.fullName || ''}
                onChange={e => setPilgrim({
                  ...pilgrim,
                  fullName: e.target.value,
                  firstName: e.target.value.trim().split(' ')[0] || '',
                  lastName: e.target.value.trim().split(' ').slice(1).join(' ') || '',
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">Age *</label>
                <input
                  type="number"
                  className="sp-input text-xs"
                  placeholder="Age in years"
                  min="1"
                  max="120"
                  value={pilgrim.age ?? ''}
                  onChange={e => setPilgrim({ ...pilgrim, age: Number(e.target.value) || undefined })}
                />
              </div>
              <div>
                <label className="sp-label">Gender *</label>
                <select
                  className="sp-input text-xs"
                  value={pilgrim.gender ?? ''}
                  onChange={e => setPilgrim({ ...pilgrim, gender: e.target.value as Gender })}
                >
                  <option value="">Select</option>
                  <option value={Gender.MALE}>Male</option>
                  <option value={Gender.FEMALE}>Female</option>
                  <option value={Gender.OTHER}>Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="sp-label">Date of Birth (Optional)</label>
              <input
                type="date"
                className="sp-input text-xs"
                value={pilgrim.dateOfBirth || ''}
                onChange={e => setPilgrim({ ...pilgrim, dateOfBirth: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Section 2: IDENTITY */}
        {activeTab === 'identity' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div>
              <label className="sp-label">Photo ID Proof *</label>
              <select
                className="sp-input text-xs"
                value={pilgrim.idType ?? IdType.AADHAAR}
                onChange={e => setPilgrim({ ...pilgrim, idType: e.target.value as IdType })}
              >
                <option value={IdType.AADHAAR}>Aadhaar Card</option>
                <option value={IdType.PASSPORT}>Passport</option>
                <option value={IdType.VOTER_ID}>Voter ID</option>
                <option value={IdType.PAN}>PAN Card</option>
                <option value={IdType.DRIVING_LICENSE}>Driving License</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="sp-label mb-0">Photo ID Number *</label>
                <button
                  type="button"
                  onClick={() => setShowIdPlain(!showIdPlain)}
                  className="text-[10px] font-semibold text-[#5B2A86] dark:text-gold-400 hover:underline"
                >
                  {showIdPlain ? 'Hide' : 'Show ID'}
                </button>
              </div>
              <input
                type={showIdPlain ? 'text' : 'password'}
                className="sp-input text-xs font-mono"
                placeholder={pilgrim.idType === IdType.AADHAAR ? '12-digit Aadhaar Number' : 'Photo ID Number'}
                value={pilgrim.idNumber || ''}
                aria-label="Photo ID Number"
                onChange={e => {
                  let val = e.target.value;
                  if (pilgrim.idType === IdType.AADHAAR) {
                    val = val.replace(/\D/g, '').slice(0, 12);
                  }
                  setPilgrim({ ...pilgrim, idNumber: val });
                }}
              />
              <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4] mt-1">
                Masked display: <span className="font-mono">{maskIdDisplay(pilgrim.idNumber)}</span>
              </p>
            </div>
          </div>
        )}

        {/* Section 3: CONTACT */}
        {activeTab === 'contact' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div>
              <label className="sp-label">Mobile Number (Optional)</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                className="sp-input text-xs font-mono"
                placeholder="10-digit mobile number"
                value={pilgrim.mobile || ''}
                onChange={e => setPilgrim({ ...pilgrim, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
              <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                Optional devotee mobile. Booking contact mobile is maintained in General Details.
              </p>
            </div>

            <div>
              <label className="sp-label">Email Address (Optional)</label>
              <input
                type="email"
                className="sp-input text-xs"
                placeholder="devotee@example.com"
                value={pilgrim.email || ''}
                onChange={e => setPilgrim({ ...pilgrim, email: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Section 4: ADDRESS */}
        {activeTab === 'address' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div>
              <label className="sp-label">City / Town</label>
              <input
                type="text"
                className="sp-input text-xs"
                placeholder="e.g. Tirupati"
                value={pilgrim.city || ''}
                onChange={e => setPilgrim({ ...pilgrim, city: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">State</label>
                <select
                  className="sp-input text-xs"
                  value={pilgrim.state || 'Andhra Pradesh'}
                  onChange={e => setPilgrim({ ...pilgrim, state: e.target.value })}
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sp-label">PIN Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="sp-input text-xs font-mono"
                  placeholder="6 digits"
                  value={pilgrim.pinCode || ''}
                  onChange={e => setPilgrim({ ...pilgrim, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                />
              </div>
            </div>

            <div>
              <label className="sp-label">Country</label>
              <input
                type="text"
                className="sp-input text-xs"
                placeholder="India"
                value={pilgrim.country || 'India'}
                onChange={e => setPilgrim({ ...pilgrim, country: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Section 5: PHOTO */}
        {activeTab === 'photo' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div className="p-2.5 rounded-xl bg-gold-50 dark:bg-[#321B3F] border border-gold-500/20 text-2xs space-y-1">
              <p className="font-bold text-[#5B2A86] dark:text-gold-300">Photo & Travel Notes</p>
              <p className="text-[#6B5A70] dark:text-[#A692B4]">
                Carry physical original Photo ID cards to the Vaikuntam queue complex for biometric/physical verification.
              </p>
            </div>

            <div>
              <label className="sp-label">Pilgrim Notes (Optional)</label>
              <textarea
                rows={2}
                className="sp-input text-xs resize-none"
                placeholder="e.g. Senior citizen assistance, special needs, etc."
                value={pilgrim.notes || ''}
                onChange={e => setPilgrim({ ...pilgrim, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Modal footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gold-500/20">
          <button className="sp-btn-secondary text-xs py-1.5 px-3" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sp-btn-primary text-xs py-1.5 px-3"
            onClick={() => onSave(pilgrim)}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
