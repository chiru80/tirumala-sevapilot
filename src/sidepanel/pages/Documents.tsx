import React, { useState, useEffect } from 'react';
import { getProfiles } from '@storage/repository';
import { maskSensitiveValue } from '@shared/utils';
import type { Profile } from '@shared/types';
import { TempleDivider } from '../components/TempleDivider';
import { t } from '@i18n/index';

export function Documents() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const list = await getProfiles();
    setProfiles(list);
    if (list.length > 0 && !selectedProfileId) {
      setSelectedProfileId(list[0].id);
    }
  }

  const profile = profiles.find(p => p.id === selectedProfileId);

  function toggleReveal(id: string) {
    setRevealedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-4 space-y-3.5 animate-fade-in text-[#321B3F] dark:text-[#F8EFD8]">
      <div>
        <h2 className="text-xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">
          {t('documents.title')}
        </h2>
        <p className="text-sm text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
          {t('documents.subtitle')}
        </p>
      </div>

      <TempleDivider variant="compact" />

      {profiles.length > 1 && (
        <select
          value={selectedProfileId}
          onChange={e => setSelectedProfileId(e.target.value)}
          className="sp-input text-base font-serif"
        >
          {profiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.pilgrims?.length || 0} devotees)
            </option>
          ))}
        </select>
      )}

      {/* TTD Physical Verification Guideline */}
      <div className="p-3 rounded-xl bg-gold-100/60 dark:bg-gold-950/40 border border-gold-400/40 text-sm space-y-1">
        <div className="font-serif font-bold text-gold-900 dark:text-gold-200 flex items-center gap-1.5 text-sm">
          <span>🏛️</span>
          <span>{t('documents.verificationRequirement')}</span>
        </div>
        <p className="text-xs text-gold-950/80 dark:text-gold-300/80 leading-relaxed">
          {t('documents.verificationNotice')}
        </p>
      </div>

      {/* Devotee ID Cards */}
      <div className="space-y-2.5">
        {profile?.pilgrims.map((p) => {
          const isRevealed = revealedIds[p.id];
          const displayId = isRevealed ? p.idNumber : maskSensitiveValue(p.idNumber, 'aadhaar');

          return (
            <div
              key={p.id}
              className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-2 p-3.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-serif font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                    {p.fullName || `${p.firstName} ${p.lastName}`}
                  </div>
                  <div className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                    {p.idType} Card • {p.gender} • {p.dateOfBirth || `Age ${p.age || '—'}`}
                  </div>
                </div>
                <span className="sp-pill sp-pill-success text-xs">
                  {t('documents.verifiedId')}
                </span>
              </div>

              {/* ID Box with Gold Accent */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-cream/60 dark:bg-[#211526]/70 border border-gold-500/20 font-mono text-sm">
                <span className="tracking-wider text-sm font-bold text-[#5B2A86] dark:text-gold-300">
                  {displayId || t('documents.notSet')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleReveal(p.id)}
                    className="px-2.5 py-1 rounded-lg text-[#6B5A70] hover:text-[#5B2A86] dark:hover:text-gold-300 text-xs font-semibold border border-gold-500/20 hover:border-gold-500/40 transition-colors"
                    title={isRevealed ? t('documents.hide') : t('documents.show')}
                  >
                    {isRevealed ? t('documents.hide') : t('documents.show')}
                  </button>
                  <button
                    onClick={() => copyToClipboard(p.idNumber, p.id)}
                    className="px-2.5 py-1 rounded-lg text-[#6B5A70] hover:text-[#5B2A86] dark:hover:text-gold-300 text-xs font-semibold border border-gold-500/20 hover:border-gold-500/40 transition-colors"
                    title="Copy ID Number"
                  >
                    {copiedId === p.id ? t('documents.copied') : t('documents.copy')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
