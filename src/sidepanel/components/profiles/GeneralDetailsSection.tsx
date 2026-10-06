import React, { useState, useEffect } from 'react';
import type { Profile } from '@shared/types';
import { updateGeneralDetails } from '@storage/repository';
import { t } from '@i18n/index';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Maharashtra',
  'Kerala', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh',
  'Delhi', 'Odisha', 'West Bengal', 'Bihar', 'Punjab', 'Haryana',
  'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'Goa', 'Himachal Pradesh'
];

function maskPhoneDisplay(val?: string): string {
  if (!val) return '—';
  const digits = val.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `••••••${digits.slice(-4)}`;
  }
  return '••••';
}

export interface GeneralDetailsSectionProps {
  profile: Profile;
  onUpdate: () => void;
}

export function GeneralDetailsSection({
  profile,
  onUpdate,
}: GeneralDetailsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gothram, setGothram] = useState(profile.general?.gothram || '');
  const [mobile, setMobile] = useState(profile.general?.mobile || '');
  const [email, setEmail] = useState(profile.general?.email || profile?.pilgrims?.[0]?.email || '');
  const [city, setCity] = useState(profile.general?.city || profile?.pilgrims?.[0]?.city || '');
  const [state, setState] = useState(profile.general?.state || profile?.pilgrims?.[0]?.state || 'Andhra Pradesh');
  const [country, setCountry] = useState(profile.general?.country || profile?.pilgrims?.[0]?.country || 'India');
  const [pinCode, setPinCode] = useState(profile.general?.pinCode || profile?.pilgrims?.[0]?.pinCode || '');
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setGothram(profile.general?.gothram || '');
    setMobile(profile.general?.mobile || '');
    setEmail(profile.general?.email || profile?.pilgrims?.[0]?.email || '');
    setCity(profile.general?.city || profile?.pilgrims?.[0]?.city || '');
    setState(profile.general?.state || profile?.pilgrims?.[0]?.state || 'Andhra Pradesh');
    setCountry(profile.general?.country || profile?.pilgrims?.[0]?.country || 'India');
    setPinCode(profile.general?.pinCode || profile?.pilgrims?.[0]?.pinCode || '');
  }, [profile]);

  async function handleSaveGeneral() {
    await updateGeneralDetails(profile.id, {
      gothram: gothram.trim() || undefined,
      mobile: mobile.replace(/\D/g, '').slice(0, 10) || undefined,
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      state: state || undefined,
      country: country.trim() || 'India',
      pinCode: pinCode.replace(/\D/g, '').slice(0, 6) || undefined,
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
    onUpdate();
  }

  function handleCopyFromPrimary() {
    const primary = profile?.pilgrims?.[0];
    if (!primary) return;
    if (primary.mobile && !mobile) setMobile(primary.mobile);
    if (primary.email) setEmail(primary.email);
    if (primary.city) setCity(primary.city);
    if (primary.state) setState(primary.state);
    if (primary.country) setCountry(primary.country);
    if (primary.pinCode) setPinCode(primary.pinCode);
  }

  const cleanMobile = mobile.replace(/\D/g, '');
  const hasValidMobile = cleanMobile.length === 10;

  return (
    <div className="rounded-xl border border-gold-500/25 bg-gradient-to-br from-amber-50/40 via-white to-purple-50/20 dark:from-[#2A1733] dark:to-[#1F1226] p-3 space-y-2.5">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#54258A]/10 dark:bg-gold-500/20 text-[#54258A] dark:text-gold-300 flex items-center justify-center text-xs">
            📍
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-serif text-[#321B3F] dark:text-[#F8EFD8]">
                General Details (Step 2 Booking Details)
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                hasValidMobile
                  ? 'bg-[#E8F5E9] text-[#1B5E20] dark:bg-[#1B3E2B] dark:text-[#A5D6A7]'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {hasValidMobile ? '✓ Mobile Ready' : '⚠ Mobile Required'}
              </span>
            </div>
            <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
              {mobile ? `📱 ${maskPhoneDisplay(mobile)}` : 'Booking mobile number required for TTD OTP'}
              {city && pinCode ? ` • ${city}, ${state} (${pinCode})` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {savedMsg && (
            <span className="text-xs font-semibold text-[#1B5E20] dark:text-[#A5D6A7] animate-fade-in">
              Saved ✓
            </span>
          )}
          <svg className={`w-4 h-4 text-[#6B5A70] transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="pt-2 border-t border-gold-500/15 space-y-3 text-sm animate-slide-up">
          {/* Gothram — required for Homam and certain Arjitha Sevas */}
          <div>
            <label className="sp-label text-sm mb-1">
              {t('pilgrim.gothram')} <span className="text-xs text-[#6B5A70] dark:text-[#A692B4]">(Required for Homam)</span>
            </label>
            <input
              type="text"
              value={gothram}
              onChange={e => setGothram(e.target.value)}
              placeholder="e.g. Kashyapa, Bharadwaja, Vasishta"
              className="sp-input text-base"
            />
          </div>

          <div>
            <label className="sp-label text-sm mb-1">
              Booking Mobile (10 digits) *
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number for OTP confirmation"
              className="sp-input text-base font-mono"
            />
            {mobile.length > 0 && !hasValidMobile && (
              <p className="text-xs text-rose-500 mt-1">Mobile number must be exactly 10 digits</p>
            )}
          </div>

          <div>
            <label className="sp-label text-sm mb-1">
              Email ID
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. devotee@gmail.com"
              className="sp-input text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="sp-label text-sm mb-1">
                Enter City *
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Tirupati"
                className="sp-input text-base"
              />
            </div>
            <div>
              <label className="sp-label text-sm mb-1">
                State *
              </label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                className="sp-input text-base"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="sp-label text-sm mb-1">
                Country *
              </label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="India"
                className="sp-input text-base"
              />
            </div>
            <div>
              <label className="sp-label text-sm mb-1">
                Enter pincode *
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinCode}
                onChange={e => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="e.g. 517501"
                className="sp-input text-base font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {(profile?.pilgrims?.length || 0) > 0 && (
              <button
                type="button"
                onClick={handleCopyFromPrimary}
                className="text-xs text-[#54258A] dark:text-gold-400 font-semibold hover:underline min-h-[44px] flex items-center"
              >
                Copy from {profile?.pilgrims?.[0]?.fullName || 'First Devotee'}
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveGeneral}
              className="sp-btn-primary ml-auto min-h-[44px] text-sm py-2 px-4"
            >
              {t('profiles.saveGeneral')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
