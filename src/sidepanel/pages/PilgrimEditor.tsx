import React, { useState } from 'react';
import { Gender, IdType } from '@shared/types';
import type { Pilgrim } from '@shared/types';
import { validateAadhaar } from '@validation/aadhaar';
import { validateMobile } from '@validation/mobile';
import { validateEmail } from '@validation/email';
import { validatePinCode } from '@validation/pincode';
import { validateDob } from '@validation/dob';
import { calculateAge } from '@shared/utils';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Maharashtra',
  'Kerala', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh',
  'Delhi', 'Odisha', 'West Bengal', 'Bihar', 'Punjab', 'Haryana',
  'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'Goa', 'Himachal Pradesh'
];

interface PilgrimEditorProps {
  initialPilgrim?: Partial<Pilgrim>;
  onSave: (pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function PilgrimEditor({ initialPilgrim, onSave, onCancel }: PilgrimEditorProps) {
  const [firstName, setFirstName] = useState(initialPilgrim?.firstName || '');
  const [lastName, setLastName] = useState(initialPilgrim?.lastName || '');
  const [gender, setGender] = useState<Gender>(initialPilgrim?.gender || Gender.MALE);
  const [dob, setDob] = useState(initialPilgrim?.dateOfBirth || '1990-01-01');
  const [idType, setIdType] = useState<IdType>(initialPilgrim?.idType || IdType.AADHAAR);
  const [idNumber, setIdNumber] = useState(initialPilgrim?.idNumber || '');
  const [mobile, setMobile] = useState(initialPilgrim?.mobile || '');
  const [email, setEmail] = useState(initialPilgrim?.email || '');
  const [address, setAddress] = useState(initialPilgrim?.address || '');
  const [city, setCity] = useState(initialPilgrim?.city || '');
  const [state, setState] = useState(initialPilgrim?.state || 'Andhra Pradesh');
  const [pinCode, setPinCode] = useState(initialPilgrim?.pinCode || '');
  const [country, setCountry] = useState(initialPilgrim?.country || 'India');
  const [photo, setPhoto] = useState<string | undefined>(initialPilgrim?.photo);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleSave() {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';

    const dobVal = validateDob(dob);
    if (!dobVal.valid) newErrors.dob = dobVal.error || 'Invalid date of birth';

    if (idType === IdType.AADHAAR) {
      if (idNumber.length !== 12) {
        newErrors.idNumber = 'Aadhaar number must be exactly 12 digits';
      } else {
        const aadhaarVal = validateAadhaar(idNumber);
        if (!aadhaarVal.valid) newErrors.idNumber = aadhaarVal.error || 'Invalid 12-digit Aadhaar';
      }
    } else if (!idNumber.trim()) {
      newErrors.idNumber = 'ID number is required';
    }

    if (mobile.trim()) {
      if (mobile.length !== 10) {
        newErrors.mobile = 'Mobile number must be exactly 10 digits';
      } else {
        const mobileVal = validateMobile(mobile);
        if (!mobileVal.valid) newErrors.mobile = mobileVal.error || 'Invalid 10-digit mobile';
      }
    }

    if (email) {
      const emailVal = validateEmail(email);
      if (!emailVal.valid) newErrors.email = emailVal.error || 'Invalid email format';
    }

    if (pinCode) {
      const pinVal = validatePinCode(pinCode);
      if (!pinVal.valid) newErrors.pinCode = pinVal.error || 'Invalid 6-digit PIN code';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const calculatedAge = calculateAge(dob);

    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName,
      gender,
      dateOfBirth: dob,
      age: calculatedAge,
      idType,
      idNumber: idNumber.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state || undefined,
      pinCode: pinCode.trim() || undefined,
      country: country || 'India',
      photo,
    });
  }

  return (
    <div className="p-4 space-y-4 bg-white dark:bg-surface-card-dark rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          {initialPilgrim?.fullName ? `Edit: ${initialPilgrim.fullName}` : 'Add New Pilgrim'}
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">First Name *</label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
          {errors.firstName && <span className="text-[10px] text-rose-500">{errors.firstName}</span>}
        </div>
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Last Name *</label>
          <input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
          {errors.lastName && <span className="text-[10px] text-rose-500">{errors.lastName}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Gender *</label>
          <select
            value={gender}
            onChange={e => setGender(e.target.value as Gender)}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          >
            <option value={Gender.MALE}>Male</option>
            <option value={Gender.FEMALE}>Female</option>
            <option value={Gender.OTHER}>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Date of Birth *</label>
          <input
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
          {errors.dob && <span className="text-[10px] text-rose-500">{errors.dob}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">ID Type *</label>
          <select
            value={idType}
            onChange={e => {
              const newType = e.target.value as IdType;
              setIdType(newType);
              if (newType === IdType.AADHAAR) {
                setIdNumber(prev => prev.replace(/\D/g, '').slice(0, 12));
              }
            }}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          >
            <option value={IdType.AADHAAR}>Aadhaar Card</option>
            <option value={IdType.PASSPORT}>Passport</option>
            <option value={IdType.VOTER_ID}>Voter ID</option>
            <option value={IdType.PAN}>PAN Card</option>
            <option value={IdType.DRIVING_LICENSE}>Driving License</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">
            {idType === IdType.AADHAAR ? 'Aadhaar Number (12 digits) *' : 'ID Number *'}
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
            placeholder={idType === IdType.AADHAAR ? '12 digits only' : 'ID number'}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white font-mono"
          />
          {errors.idNumber && <span className="text-[10px] text-rose-500">{errors.idNumber}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Mobile Phone (Optional, 10 digits)</label>
          <input
            type="tel"
            inputMode="numeric"
            value={mobile}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
              setMobile(val);
            }}
            maxLength={10}
            placeholder="10 digits only"
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
          {errors.mobile && <span className="text-[10px] text-rose-500">{errors.mobile}</span>}
        </div>
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Email (Optional)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@email.com"
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
          {errors.email && <span className="text-[10px] text-rose-500">{errors.email}</span>}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[11px] font-bold text-[#5B2A86] dark:text-[#D4A72C] mb-2 uppercase tracking-wider">
          General Details (TTD Step 2 Autofill)
        </p>
      </div>

      <div className="text-xs space-y-1">
        <label className="block text-gray-600 dark:text-gray-400 font-medium">Address Line</label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="House / Street"
          className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Enter City *</label>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="City / Town"
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">State *</label>
          <select
            value={state}
            onChange={e => setState(e.target.value)}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          >
            {INDIAN_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Country *</label>
          <input
            type="text"
            value={country}
            onChange={e => setCountry(e.target.value)}
            placeholder="India"
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-gray-600 dark:text-gray-400 font-medium mb-0.5">Enter pincode *</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pinCode}
            onChange={e => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 digits"
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white font-mono"
          />
          {errors.pinCode && <span className="text-[10px] text-rose-500">{errors.pinCode}</span>}
        </div>
      </div>

      <div className="text-xs">
        <label className="block text-gray-600 dark:text-gray-400 font-medium mb-1">Pilgrim Photo (Optional)</label>
        <div className="flex items-center gap-3">
          {photo && (
            <img src={photo} alt="Pilgrim" className="w-10 h-10 rounded-full object-cover border border-saffron-500" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:bg-gray-100 dark:file:bg-gray-800 file:text-gray-700 dark:file:text-gray-300"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onCancel}
          className="py-1.5 px-3 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="py-1.5 px-4 rounded-lg text-xs font-semibold bg-saffron-500 hover:bg-saffron-600 text-white shadow-sm transition"
        >
          Save Pilgrim
        </button>
      </div>
    </div>
  );
}
