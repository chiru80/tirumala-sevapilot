import React, { useState, useEffect } from 'react';
import { t } from '@i18n/index';
import { getProfiles } from '@storage/repository';
import { validateAadhaar } from '@validation/aadhaar';
import { validateMobile } from '@validation/mobile';
import { validateEmail } from '@validation/email';
import { validatePinCode } from '@validation/pincode';
import { validateDob } from '@validation/dob';
import { detectDuplicateIds } from '@validation/duplicates';
import { IdType } from '@shared/types';
import type { Profile, Pilgrim, ValidationResult } from '@shared/types';
import { TempleDivider } from '../components/TempleDivider';

interface PilgrimValidation {
  pilgrim: Pilgrim;
  results: ValidationResult[];
  isComplete: boolean;
}

export function Validation() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [validations, setValidations] = useState<PilgrimValidation[]>([]);
  const [duplicates, setDuplicates] = useState<ValidationResult[]>([]);
  const [generalContactValid, setGeneralContactValid] = useState<boolean>(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      runValidation();
    }
  }, [selectedProfileId, profiles]);

  async function loadProfiles() {
    const p = await getProfiles();
    setProfiles(p);
    if (p.length > 0) {
      const defaultProfile = p.find(pr => pr.isDefault) ?? p[0];
      setSelectedProfileId(defaultProfile.id);
    }
  }

  function runValidation() {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;

    // Check General Details mobile separately (Booking Readiness)
    const genMobile = (profile.general?.mobile || '').replace(/\D/g, '');
    setGeneralContactValid(genMobile.length === 10);

    const results: PilgrimValidation[] = (profile.pilgrims || []).map(pilgrim => {
      const validationResults: ValidationResult[] = [];

      // Required fields check:
      // 1. Name
      const name = (pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`).trim();
      if (!name) {
        validationResults.push({ field: 'name', valid: false, error: 'Full name required' });
      }

      // 2. Gender
      if (!pilgrim.gender) {
        validationResults.push({ field: 'gender', valid: false, error: 'Gender required' });
      }

      // 3. Age OR DOB check
      const hasAge = typeof pilgrim.age === 'number' && pilgrim.age > 0 && pilgrim.age < 125;
      if (pilgrim.dateOfBirth) {
        validationResults.push(validateDob(pilgrim.dateOfBirth));
      } else if (hasAge) {
        validationResults.push({ field: 'age', valid: true });
      } else {
        validationResults.push({ field: 'age', valid: false, error: 'Age or Date of Birth required' });
      }

      // 4. ID Type
      if (!pilgrim.idType) {
        validationResults.push({ field: 'idType', valid: false, error: 'ID proof required' });
      }

      // 5. ID Number
      if (!pilgrim.idNumber) {
        validationResults.push({ field: 'idNumber', valid: false, error: 'ID number required' });
      } else if (pilgrim.idType === IdType.AADHAAR || (pilgrim.idType as string) === 'Aadhaar') {
        validationResults.push(validateAadhaar(pilgrim.idNumber));
      }

      // Optional fields: only validate format if provided
      if (pilgrim.mobile && pilgrim.mobile.trim()) {
        validationResults.push(validateMobile(pilgrim.mobile));
      }

      if (pilgrim.email && pilgrim.email.trim()) {
        validationResults.push(validateEmail(pilgrim.email));
      }

      if (pilgrim.pinCode && pilgrim.pinCode.trim()) {
        validationResults.push(validatePinCode(pilgrim.pinCode));
      }

      const isComplete = validationResults.every(r => r.valid);

      return { pilgrim, results: validationResults, isComplete };
    });

    setValidations(results);

    // Duplicate ID check
    const dupes = detectDuplicateIds(profile.pilgrims || []);
    setDuplicates(dupes);
  }

  const allDevoteesValid = validations.length > 0 && validations.every(v => v.isComplete) && duplicates.length === 0;

  return (
    <div className="p-4 space-y-3.5 animate-fade-in text-[#321B3F] dark:text-[#F8EFD8]">
      <div>
        <h2 className="text-xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">
          {t('validation.title')}
        </h2>
        <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
          {t('validation.subtitle')}
        </p>
      </div>

      <TempleDivider variant="compact" />

      {/* Profile Selector */}
      {profiles.length > 1 && (
        <div>
          <label className="sp-label">{t('dashboard.profile')}:</label>
          <select
            value={selectedProfileId}
            onChange={e => setSelectedProfileId(e.target.value)}
            className="sp-input text-xs font-serif"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.pilgrims?.length || 0} {p.pilgrims?.length === 1 ? 'pilgrim' : 'pilgrims'})</option>
            ))}
          </select>
        </div>
      )}

      {/* Overall Devotee Health Card */}
      <div className={`sp-card border-l-4 ${
        allDevoteesValid
          ? 'border-l-[#2E7D5B] bg-gradient-to-r from-[#EBF5F0] to-white dark:from-[#21352A] dark:to-[#211526]'
          : 'border-l-gold-500 bg-gradient-to-r from-cream to-white dark:from-[#3D224C] dark:to-[#211526]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            allDevoteesValid ? 'bg-[#2E7D5B]/15 text-[#2E7D5B]' : 'bg-gold-500/20 text-gold-700 dark:text-gold-300'
          }`}>
            {allDevoteesValid ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            )}
          </div>
          <div>
            <p className={`text-sm font-serif font-bold ${
              allDevoteesValid ? 'text-[#2E7D5B] dark:text-emerald-400' : 'text-gold-800 dark:text-gold-300'
            }`}>
              {allDevoteesValid ? `✓ ${t('validation.allDevoteesReady')}` : `⚠ ${t('validation.attentionNeeded')}`}
            </p>
            <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
              {validations.filter(v => v.isComplete).length} of {validations.length} pilgrim{validations.length === 1 ? '' : 's'} verified
            </p>
          </div>
        </div>
      </div>

      {/* Separate Booking Readiness Card (General Details Mobile) */}
      <div className={`sp-card border-l-4 ${
        generalContactValid
          ? 'border-l-[#2E7D5B] bg-white dark:bg-[#2D1A38]'
          : 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">{generalContactValid ? '✓' : '⚠'}</span>
            <div>
              <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                {t('validation.bookingContactCheck')}
              </p>
              <p className="text-xs text-[#6B5A70] dark:text-[#A692B4]">
                {generalContactValid
                  ? t('dashboard.mobileReady')
                  : t('dashboard.mobileRequiredInGeneral')}
              </p>
            </div>
          </div>
          <span className={generalContactValid ? 'sp-pill-success' : 'sp-pill-warning'}>
            {generalContactValid ? t('dashboard.ready') : t('dashboard.notReady')}
          </span>
        </div>
      </div>

      {/* Duplicate ID Warning */}
      {duplicates.length > 0 && (
        <div className="sp-card border-red-300 dark:border-red-800 bg-[#FDF2F2] dark:bg-red-950/30">
          <div className="text-xs font-bold text-temple-red uppercase tracking-wider mb-1">
            ⚠ {t('validation.duplicateFound')}
          </div>
          {duplicates.map((dup, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-temple-red font-medium">
              <span>•</span>
              <span>{dup.warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-pilgrim Validation Cards */}
      <div className="space-y-2">
        {validations.map(({ pilgrim, results, isComplete }) => (
          <div key={pilgrim.id} className="sp-card bg-white dark:bg-[#2D1A38]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-cream dark:bg-[#321B3F] border border-gold-500/30 text-gold-700 dark:text-gold-300 text-xs font-bold flex items-center justify-center shrink-0">
                  {(pilgrim.firstName || pilgrim.fullName || '?').charAt(0)}
                </span>
                <span className="text-xs font-serif font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                  {pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`}
                </span>
              </div>
              <span className={isComplete ? 'sp-pill-success' : 'sp-pill-warning'}>
                {isComplete ? t('dashboard.ready') : t('dashboard.notReady')}
              </span>
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-gold-500/15">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs ${
                    result.valid ? 'text-[#2E7D5B] dark:text-emerald-400' : 'text-temple-red font-medium'
                  }`}
                >
                  {result.valid ? (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  )}
                  <span>{result.valid ? `${result.field} verified` : result.error || result.warning}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
