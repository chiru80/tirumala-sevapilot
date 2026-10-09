import React, { useState } from 'react';
import { Gender, IdType } from '@shared/types';
import type { Pilgrim } from '@shared/types';
import { validateDevoteePhotoFile } from '../../../security/file-security';
import { BackButton } from '../../design-system';
import { t } from '@i18n/index';

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
 * 6-Section Comprehensive Pilgrim Editor Modal
 * Sections: PERSONAL, IDENTITY, CONTACT, ADDRESS, SRIVARI SEVA, PHOTO & NOTES
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
  const [pilgrim, setPilgrim] = useState<Pilgrim>({
    ...editPilgrim.pilgrim,
    srivariSeva: { ...editPilgrim.pilgrim.srivariSeva },
  });
  const [showIdPlain, setShowIdPlain] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'identity' | 'contact' | 'address' | 'srivari' | 'photo'>('personal');

  const tabs: Array<{ id: 'personal' | 'identity' | 'contact' | 'address' | 'srivari' | 'photo'; label: string }> = [
    { id: 'personal', label: '1. Personal' },
    { id: 'identity', label: '2. Identity' },
    { id: 'contact', label: '3. Contact' },
    { id: 'address', label: '4. Address' },
    { id: 'srivari', label: '5. Srivari Seva' },
    { id: 'photo', label: '6. Photo & Notes' },
  ];

  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateDevoteePhotoFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || 'Invalid file');
      return;
    }
    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPilgrim(prev => ({ ...prev, photo: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 animate-fade-in">
      <div className="bg-white dark:bg-[#2D1A38] p-4 rounded-2xl shadow-2xl w-full max-w-md border border-gold-500/30 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gold-500/15">
          <div className="flex items-center gap-1.5">
            <BackButton onClick={onClose} aria-label={t('common.back') || 'Back'} />
            <div>
              <h3 className="text-xs font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">
                Edit Pilgrim Details
              </h3>
              <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4]">
                {pilgrim.fullName || 'New Pilgrim'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common.close') || 'Close'} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold p-1">
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
                placeholder="Pilgrim name as per Photo ID"
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
              <div className="flex items-center justify-between">
                <label className="sp-label">Date of Birth</label>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                  * Required for Srivari Seva
                </span>
              </div>
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
              <div className="flex items-center justify-between">
                <label className="sp-label">Pilgrim Mobile Number</label>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                  * Required for Srivari Seva
                </span>
              </div>
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
                Optional for standard Darshan; required for Srivari Seva enrollment.
              </p>
            </div>

            <div>
              <label className="sp-label">Email Address (Optional)</label>
              <input
                type="email"
                className="sp-input text-xs"
                placeholder="pilgrim@example.com"
                value={pilgrim.email || ''}
                onChange={e => setPilgrim({ ...pilgrim, email: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Section 4: ADDRESS */}
        {activeTab === 'address' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">Door / Flat Number</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. 4-12/A"
                  value={pilgrim.srivariSeva?.doorNumber || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, doorNumber: e.target.value },
                  })}
                />
              </div>
              <div>
                <label className="sp-label">Street / Area</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. Temple Street"
                  value={pilgrim.srivariSeva?.street || pilgrim.address || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    address: e.target.value,
                    srivariSeva: { ...pilgrim.srivariSeva, street: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">District *</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. Chittoor / Tirupati"
                  value={pilgrim.district || ''}
                  onChange={e => setPilgrim({ ...pilgrim, district: e.target.value })}
                />
              </div>
              <div>
                <label className="sp-label">City / Town *</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. Tirupati"
                  value={pilgrim.city || ''}
                  onChange={e => setPilgrim({ ...pilgrim, city: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">State *</label>
                <select
                  className="sp-input text-xs"
                  value={pilgrim.state || ''}
                  onChange={e => setPilgrim({ ...pilgrim, state: e.target.value })}
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sp-label">PIN Code *</label>
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
                placeholder="e.g. India"
                value={pilgrim.country || ''}
                onChange={e => setPilgrim({ ...pilgrim, country: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Section 5: SRIVARI SEVA DETAILS */}
        {activeTab === 'srivari' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div className="p-2.5 rounded-xl bg-gold-50 dark:bg-[#321B3F] border border-gold-500/25 text-2xs space-y-1">
              <p className="font-bold text-[#5B2A86] dark:text-gold-300">Srivari Seva Voluntary Service Fields</p>
              <p className="text-[#6B5A70] dark:text-[#A692B4]">
                The official Srivari Seva enrollment page requires full personal details, verified photo, and residential address with Door Number and District.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">Door Number *</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. 1-23"
                  value={pilgrim.srivariSeva?.doorNumber || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, doorNumber: e.target.value },
                  })}
                />
              </div>
              <div>
                <label className="sp-label">Street *</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="Street name"
                  value={pilgrim.srivariSeva?.street || pilgrim.address || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    address: e.target.value,
                    srivariSeva: { ...pilgrim.srivariSeva, street: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">District *</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="District name"
                  value={pilgrim.district || ''}
                  onChange={e => setPilgrim({ ...pilgrim, district: e.target.value })}
                />
              </div>
              <div>
                <label className="sp-label">Mandal / Taluk</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="Mandal / Block"
                  value={pilgrim.srivariSeva?.mandal || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, mandal: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">Father / Spouse Name</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="Parent / Spouse"
                  value={pilgrim.srivariSeva?.fatherSpouseName || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, fatherSpouseName: e.target.value },
                  })}
                />
              </div>
              <div>
                <label className="sp-label">Blood Group</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. O+, A+, B+"
                  value={pilgrim.srivariSeva?.bloodGroup || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, bloodGroup: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sp-label">Qualification</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. Graduate"
                  value={pilgrim.srivariSeva?.qualification || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, qualification: e.target.value },
                  })}
                />
              </div>
              <div>
                <label className="sp-label">Profession</label>
                <input
                  type="text"
                  className="sp-input text-xs"
                  placeholder="e.g. Teacher, Engineer"
                  value={pilgrim.srivariSeva?.profession || ''}
                  onChange={e => setPilgrim({
                    ...pilgrim,
                    srivariSeva: { ...pilgrim.srivariSeva, profession: e.target.value },
                  })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 6: PHOTO & NOTES */}
        {activeTab === 'photo' && (
          <div className="space-y-2.5 animate-fade-in text-xs">
            <div className="p-3 rounded-xl bg-gold-50/60 dark:bg-[#321B3F]/60 border border-gold-500/20 space-y-2">
              <label className="sp-label font-bold text-[#5B2A86] dark:text-gold-300">
                Pilgrim Photo {pilgrim.photo ? '✓ Uploaded' : '(Required for Srivari Seva)'}
              </label>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gold-500/40 flex items-center justify-center overflow-hidden shrink-0">
                  {pilgrim.photo ? (
                    <img src={pilgrim.photo} alt="Pilgrim" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">📷</span>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handlePhotoUpload}
                    className="text-xs text-[#6B5A70] dark:text-[#A692B4] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#5B2A86]/10 file:text-[#5B2A86] dark:file:bg-gold-500/20 dark:file:text-gold-300 hover:file:bg-[#5B2A86]/20 cursor-pointer"
                  />
                  {photoError && (
                    <p className="text-[10px] text-red-500 font-medium">{photoError}</p>
                  )}
                  {pilgrim.photo && (
                    <button
                      type="button"
                      onClick={() => setPilgrim(prev => ({ ...prev, photo: undefined }))}
                      className="text-[10px] text-red-600 hover:underline block"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
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
