import React, { useState, useEffect } from 'react';
import { t } from '@i18n/index';
import { getProfiles, updateSelectedPilgrims, updatePilgrim } from '@storage/repository';
import { getAllAdapters } from '@services/registry';
import type { Profile } from '@shared/types';
import { TempleDivider } from '../components/TempleDivider';
import { BackButton } from '../design-system';

export function Bookings({ onBack }: { onBack?: () => void } = {}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('darshan');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const adapters = getAllAdapters();
  const currentAdapter = adapters.find(a => a.serviceType === selectedService) || adapters[0];

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const list = await getProfiles();
    setProfiles(list);
    if (list.length > 0 && !selectedProfileId) {
      const def = list.find(p => p.isDefault) ?? list[0];
      setSelectedProfileId(def.id);
    }
  }

  const profile = profiles.find(p => p.id === selectedProfileId);
  const selectedPilgrimIds = profile?.selectedPilgrims?.[selectedService] ?? [];

  async function handleTogglePilgrim(pilgrimId: string) {
    if (!profile) return;
    let newSelection = [...selectedPilgrimIds];
    if (newSelection.includes(pilgrimId)) {
      newSelection = newSelection.filter(id => id !== pilgrimId);
    } else {
      if (newSelection.length >= currentAdapter.maxPilgrims) {
        setStatusMessage(`Limit reached: maximum ${currentAdapter.maxPilgrims} pilgrims for ${currentAdapter.name}`);
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }
      newSelection.push(pilgrimId);
    }
    await updateSelectedPilgrims(profile.id, selectedService, newSelection);
    await loadProfiles();
  }

  async function handleCopyLeaderContact() {
    if (!profile || !profile.pilgrims || profile.pilgrims.length === 0) return;
    const leader = profile.pilgrims[0];
    setSaving(true);
    for (let i = 1; i < profile.pilgrims.length; i++) {
      const p = profile.pilgrims[i];
      await updatePilgrim(profile.id, p.id, {
        address: leader.address,
        city: leader.city,
        district: leader.district,
        state: leader.state,
        pinCode: leader.pinCode,
        country: leader.country,
        email: leader.email,
      });
    }
    await loadProfiles();
    setSaving(false);
    setStatusMessage('Primary pilgrim contact and address shared across all pilgrims.');
    setTimeout(() => setStatusMessage(null), 3500);
  }

  return (
    <div className="p-4 space-y-3.5 animate-fade-in text-[#321B3F] dark:text-[#F8EFD8]">
      {/* Header */}
      <div className="flex items-center gap-2">
        {onBack && <BackButton onClick={onBack} />}
        <div>
          <h2 className="text-xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">
            {t('bookings.title')}
          </h2>
          <p className="text-sm text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
            {t('bookings.subtitle')}
          </p>
        </div>
      </div>

      <TempleDivider variant="compact" />

      {statusMessage && (
        <div className="p-2.5 rounded-xl text-xs bg-gold-50 dark:bg-gold-950/40 border border-gold-300 dark:border-gold-800 text-gold-900 dark:text-gold-200">
          {statusMessage}
        </div>
      )}

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="sp-label text-sm mb-1">{t('bookings.profile')}</label>
          <select
            value={selectedProfileId}
            onChange={e => setSelectedProfileId(e.target.value)}
            className="sp-input text-base"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="sp-label text-sm mb-1">{t('bookings.serviceQuota')}</label>
          <select
            value={selectedService}
            onChange={e => setSelectedService(e.target.value)}
            className="sp-input text-base font-serif"
          >
            {adapters.map(a => (
              <option key={a.id} value={a.serviceType}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Service Quota Info Card */}
      <div className="sp-card bg-cream/50 dark:bg-[#2C1A35] border-gold-500/25 p-3.5 space-y-1">
        <div className="flex justify-between items-center text-sm">
          <div>
            <span className="font-serif font-bold text-base text-[#5B2A86] dark:text-[#F8EFD8]">
              {currentAdapter.name}
            </span>
            <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
              {t('bookings.limit', { max: currentAdapter.maxPilgrims })}
            </p>
          </div>
          <span className="text-xs font-bold text-gold-700 dark:text-gold-300 bg-gold-100 dark:bg-gold-950/80 px-2.5 py-1 rounded-lg border border-gold-300/40">
            {selectedPilgrimIds.length} / {currentAdapter.maxPilgrims}
          </span>
        </div>
      </div>

      {/* Devotee Selection List */}
      {profile && Array.isArray(profile.pilgrims) && profile.pilgrims.length > 0 ? (
        <div className="space-y-2">
          <label className="sp-label text-sm font-semibold">{t('bookings.devoteesIn', { name: profile.name })}</label>
          {(profile.pilgrims || []).map(p => {
            const isSelected = selectedPilgrimIds.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => handleTogglePilgrim(p.id)}
                className={`p-3 rounded-xl border text-sm flex items-center justify-between cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'border-[#5B2A86] dark:border-gold-500 bg-gradient-to-r from-ttd-50 to-cream dark:from-ttd-950/40 dark:to-[#211526] shadow-xs'
                    : 'border-gold-500/15 bg-white dark:bg-[#2D1A38] opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    isSelected ? 'bg-[#5B2A86] border-[#5B2A86] text-white' : 'border-gold-500/40'
                  }`}>
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 text-gold-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-[#321B3F] dark:text-[#F8EFD8] block">
                      {p.fullName || `${p.firstName} ${p.lastName}`}
                    </span>
                    <span className="text-xs text-[#6B5A70] dark:text-[#A692B4]">
                      {p.gender} • {p.idType}
                    </span>
                  </div>
                </div>

                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isSelected ? 'text-[#2E7D5B] bg-emerald-50 dark:bg-emerald-950/40' : 'text-[#8B7D8F]'}`}>
                  {isSelected ? t('bookings.included') : t('bookings.tapToAdd')}
                </span>
              </div>
            );
          })}

          <button
            onClick={handleCopyLeaderContact}
            disabled={saving}
            className="sp-btn-secondary w-full min-h-[44px] text-sm py-2.5 mt-2"
          >
            <span>{t('bookings.copyLeaderContact')}</span>
          </button>
        </div>
      ) : (
        <div className="sp-empty py-8">
          <p className="text-sm text-[#8B7D8F]">{t('bookings.noDevotees')}</p>
        </div>
      )}
    </div>
  );
}
