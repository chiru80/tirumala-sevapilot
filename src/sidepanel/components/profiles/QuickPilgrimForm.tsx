import React, { useState } from 'react';
import { Gender, IdType } from '@shared/types';
import type { Pilgrim } from '@shared/types';
import { t } from '@i18n/index';
import { validateDevoteePhotoFile } from '../../../security/file-security';

export interface QuickPilgrimFormProps {
  onSave: (pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  targetServiceId?: string;
}

export function QuickPilgrimForm({ onSave, onCancel, targetServiceId }: QuickPilgrimFormProps) {
  const isSrivariInitial = targetServiceId === 'srivari-seva' || (targetServiceId && targetServiceId.includes('srivari'));
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [idType, setIdType] = useState<IdType>(IdType.AADHAAR);
  const [idNumber, setIdNumber] = useState('');
  const [mobile, setMobile] = useState('');
  const [includeSrivari, setIncludeSrivari] = useState(Boolean(isSrivariInitial));
  const [doorNumber, setDoorNumber] = useState('');
  const [street, setStreet] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateDevoteePhotoFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid file format or size');
      return;
    }
    setFormError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhoto(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

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
    if (includeSrivari) {
      if (!dob) {
        setFormError('Date of Birth is mandatory for Srivari Seva');
        return;
      }
      if (!mobile || mobile.replace(/\D/g, '').length !== 10) {
        setFormError('10-digit Mobile is mandatory for Srivari Seva');
        return;
      }
      if (!doorNumber.trim()) {
        setFormError('Door Number is mandatory for Srivari Seva');
        return;
      }
      if (!street.trim()) {
        setFormError('Street is mandatory for Srivari Seva');
        return;
      }
      if (!district.trim()) {
        setFormError('District is mandatory for Srivari Seva');
        return;
      }
    }

    setFormError(null);
    onSave({
      firstName: fullName.trim().split(' ')[0] || fullName.trim(),
      lastName: fullName.trim().split(' ').slice(1).join(' ') || '',
      fullName: fullName.trim(),
      gender,
      age: Number(age),
      dateOfBirth: dob || undefined,
      idType,
      idNumber: idNumber.trim(),
      mobile: mobile.trim() || undefined,
      country: 'India',
      city: city.trim() || undefined,
      district: district.trim() || undefined,
      pinCode: pinCode.replace(/\D/g, '').slice(0, 6) || undefined,
      address: street.trim() || undefined,
      photo,
      srivariSeva: includeSrivari ? {
        doorNumber: doorNumber.trim() || undefined,
        street: street.trim() || undefined,
      } : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 p-3 rounded-xl bg-cream/70 dark:bg-[#211526]/80 border border-gold-500/25 animate-slide-up text-xs">
      {formError && (
        <div className="p-2 rounded-lg text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 text-temple-red">
          {formError}
        </div>
      )}
      <div>
        <label className="sp-label text-xs mb-1">Name *</label>
        <input
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Enter pilgrim full name"
          className="sp-input text-xs"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="sp-label text-xs mb-1">Age *</label>
          <input
            type="number"
            value={age}
            onChange={e => setAge(e.target.value)}
            placeholder="Age"
            min="1"
            max="120"
            className="sp-input text-xs"
            required
          />
        </div>
        <div>
          <label className="sp-label text-xs mb-1">Gender *</label>
          <select value={gender} onChange={e => setGender(e.target.value as Gender)} className="sp-input text-xs">
            <option value={Gender.MALE}>Male</option>
            <option value={Gender.FEMALE}>Female</option>
            <option value={Gender.OTHER}>Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="sp-label text-xs mb-1">Photo ID Proof *</label>
          <select
            value={idType}
            onChange={e => {
              const newType = e.target.value as IdType;
              setIdType(newType);
              if (newType === IdType.AADHAAR) {
                setIdNumber(prev => prev.replace(/\D/g, '').slice(0, 12));
              }
            }}
            className="sp-input text-xs"
          >
            <option value={IdType.AADHAAR}>Aadhaar Card</option>
            <option value={IdType.PASSPORT}>Passport</option>
            <option value={IdType.VOTER_ID}>Voter ID</option>
            <option value={IdType.PAN}>PAN Card</option>
            <option value={IdType.DRIVING_LICENSE}>Driving License</option>
          </select>
        </div>
        <div>
          <label className="sp-label text-xs mb-1">
            {idType === IdType.AADHAAR ? 'Photo ID (12 digits) *' : 'Photo ID Number *'}
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
            placeholder={idType === IdType.AADHAAR ? '12 digits' : 'Enter ID number'}
            className="sp-input text-xs font-mono"
            required
          />
        </div>
      </div>

      <div>
        <label className="sp-label text-xs mb-1">Mobile Number {includeSrivari ? '*' : '(Optional)'}</label>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          className="sp-input text-xs font-mono"
        />
      </div>

      {/* Srivari Seva Details Section */}
      {isSrivariInitial ? (
        <div className="pt-1 border-t border-gold-500/15">
          <div className="flex items-center gap-1.5 py-1 text-xs font-bold text-[#5B2A86] dark:text-gold-300">
            <span>🛕</span>
            <span>Srivari Seva Required Details (DOB, Photo & Address)</span>
          </div>
        </div>
      ) : (
        <div className="pt-1 border-t border-gold-500/15">
          <label className="flex items-center gap-2 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={includeSrivari}
              onChange={e => setIncludeSrivari(e.target.checked)}
              className="accent-[#5B2A86] w-3.5 h-3.5"
            />
            <span className="font-semibold text-xs text-[#5B2A86] dark:text-gold-300">
              Include Srivari Seva Requirements (DOB, Photo & Address)
            </span>
          </label>
        </div>
      )}

      {(isSrivariInitial || includeSrivari) && (
        <div className="space-y-2 p-2.5 rounded-lg bg-[#5B2A86]/5 dark:bg-gold-500/10 border border-gold-500/20 animate-fade-in">
          <div>
            <label className="sp-label text-xs mb-0.5">Date of Birth *</label>
            <input
              type="date"
              value={dob}
              onChange={e => {
                const val = e.target.value;
                setDob(val);
                if (val && !age) {
                  const birthYear = new Date(val).getFullYear();
                  const currentYear = new Date().getFullYear();
                  if (!isNaN(birthYear) && currentYear > birthYear) {
                    setAge(String(currentYear - birthYear));
                  }
                }
              }}
              className="sp-input text-xs"
              required={Boolean(isSrivariInitial || includeSrivari)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sp-label text-xs mb-0.5">Door Number *</label>
              <input
                type="text"
                placeholder="e.g. 1-24"
                value={doorNumber}
                onChange={e => setDoorNumber(e.target.value)}
                className="sp-input text-xs"
              />
            </div>
            <div>
              <label className="sp-label text-xs mb-0.5">Street *</label>
              <input
                type="text"
                placeholder="Street name"
                value={street}
                onChange={e => setStreet(e.target.value)}
                className="sp-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sp-label text-xs mb-0.5">District *</label>
              <input
                type="text"
                placeholder="District"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="sp-input text-xs"
              />
            </div>
            <div>
              <label className="sp-label text-xs mb-0.5">City / Town</label>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="sp-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="sp-label text-xs mb-0.5">Pilgrim Photo (Optional upload)</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handlePhotoUpload}
              className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-[#5B2A86]/10 file:text-[#5B2A86]"
            />
            {photo && <span className="text-[10px] text-emerald-600 block mt-0.5">✓ Photo attached</span>}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" className="sp-btn-primary flex-1 min-h-[38px] text-xs font-bold">{t('common.save')}</button>
        <button type="button" onClick={onCancel} className="sp-btn-secondary min-h-[38px] text-xs px-3">{t('common.cancel')}</button>
      </div>
    </form>
  );
}
