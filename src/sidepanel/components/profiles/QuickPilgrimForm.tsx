import React, { useState } from 'react';
import { Gender, IdType } from '@shared/types';
import type { Pilgrim } from '@shared/types';
import { t } from '@i18n/index';

export interface QuickPilgrimFormProps {
  onSave: (pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function QuickPilgrimForm({ onSave, onCancel }: QuickPilgrimFormProps) {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [idType, setIdType] = useState<IdType>(IdType.AADHAAR);
  const [idNumber, setIdNumber] = useState('');
  const [mobile, setMobile] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('Full name is required');
      return;
    }
    if (!age || Number(age) <= 0) {
      setFormError('Valid age is required');
      return;
    }
    if (idType === IdType.AADHAAR && idNumber.length !== 12) {
      setFormError('Aadhaar number must be exactly 12 digits');
      return;
    }
    if (!idNumber.trim()) {
      setFormError('Photo ID Number is required');
      return;
    }
    setFormError(null);
    onSave({
      firstName: fullName.trim().split(' ')[0] || fullName.trim(),
      lastName: fullName.trim().split(' ').slice(1).join(' ') || '',
      fullName: fullName.trim(),
      gender,
      age: Number(age),
      dateOfBirth: '',
      idType,
      idNumber: idNumber.trim(),
      mobile: mobile.trim() || undefined,
      country: 'India',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 p-3 rounded-xl bg-cream/70 dark:bg-[#211526]/80 border border-gold-500/25 animate-slide-up">
      {formError && (
        <div className="p-2 rounded-lg text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 text-temple-red">
          {formError}
        </div>
      )}
      <div>
        <label className="sp-label text-sm mb-1">Name *</label>
        <input
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Enter pilgrim full name"
          className="sp-input text-base"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="sp-label text-sm mb-1">Age *</label>
          <input
            type="number"
            value={age}
            onChange={e => setAge(e.target.value)}
            placeholder="Age"
            min="1"
            max="120"
            className="sp-input text-base"
            required
          />
        </div>
        <div>
          <label className="sp-label text-sm mb-1">Gender *</label>
          <select value={gender} onChange={e => setGender(e.target.value as Gender)} className="sp-input text-base">
            <option value={Gender.MALE}>Male</option>
            <option value={Gender.FEMALE}>Female</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="sp-label text-sm mb-1">Photo ID Proof *</label>
          <select
            value={idType}
            onChange={e => {
              const newType = e.target.value as IdType;
              setIdType(newType);
              if (newType === IdType.AADHAAR) {
                setIdNumber(prev => prev.replace(/\D/g, '').slice(0, 12));
              }
            }}
            className="sp-input text-base"
          >
            <option value={IdType.AADHAAR}>Aadhaar Card</option>
            <option value={IdType.PASSPORT}>Passport</option>
            <option value={IdType.VOTER_ID}>Voter ID</option>
            <option value={IdType.PAN}>PAN Card</option>
            <option value={IdType.DRIVING_LICENSE}>Driving License</option>
          </select>
        </div>
        <div>
          <label className="sp-label text-sm mb-1">
            {idType === IdType.AADHAAR ? 'Photo ID Number * (12 digits)' : 'Photo ID Number *'}
          </label>
          <input
            type="text"
            inputMode={idType === IdType.AADHAAR ? 'numeric' : 'text'}
            value={idNumber}
            onChange={e => {
              let val = e.target.value;
              if (idType === IdType.AADHAAR) {
                val = val.replace(/\D/g, '').slice(0, 12);
              }
              setIdNumber(val);
            }}
            maxLength={idType === IdType.AADHAAR ? 12 : 25}
            placeholder={idType === IdType.AADHAAR ? '12 digits only' : 'Enter ID number'}
            className="sp-input text-base font-mono"
            required
          />
        </div>
      </div>

      <div>
        <label className="sp-label text-sm mb-1">Mobile Number (Optional)</label>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          className="sp-input text-base font-mono"
        />
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="submit" className="sp-btn-primary flex-1 min-h-[44px] text-sm">{t('common.save')}</button>
        <button type="button" onClick={onCancel} className="sp-btn-secondary min-h-[44px] text-sm px-4">{t('common.cancel')}</button>
      </div>
    </form>
  );
}
