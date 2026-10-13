import React, { useState } from 'react';
import { ServiceType } from '@shared/types';
import { t } from '@i18n/index';
import { BackButton } from '../../design-system';

export interface ProfileCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, defaultService?: string) => Promise<void>;
}

export function ProfileCreateModal({ isOpen, onClose, onCreate }: ProfileCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultService, setDefaultService] = useState<string>(ServiceType.DARSHAN);

  if (!isOpen) return null;

  async function handleSave() {
    if (!name.trim()) return;
    await onCreate(
      name.trim(),
      description.trim() || undefined,
      defaultService || undefined,
    );
    setName('');
    setDescription('');
    setDefaultService(ServiceType.DARSHAN);
    onClose();
  }

  return (
    <div className="sp-card bg-cream/60 dark:bg-[#2D1A38] border-gold-500/40 animate-slide-up space-y-3">
      <div className="flex items-center justify-between pb-1.5 border-b border-gold-500/15">
        <div className="flex items-center gap-1.5">
          <BackButton onClick={onClose} aria-label={t('common.back') || 'Back'} />
          <h3 className="text-sm font-serif font-bold text-[#5B2A86] dark:text-[#F8EFD8]">{t('profiles.createGroup')}</h3>
        </div>
        <button onClick={onClose} aria-label={t('common.close') || 'Close'} className="text-sm text-[#8B7D8F] hover:text-[#321B3F] cursor-pointer p-1">✕</button>
      </div>

      <div>
        <label className="sp-label">{t('profiles.profileName')} *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Family Darshan, Friends Seva"
          className="sp-input text-xs"
          autoFocus
        />
      </div>

      <div>
        <label className="sp-label">{t('profiles.descriptionOptional')}</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Annual Tirumala pilgrimage group"
          className="sp-input text-xs"
        />
      </div>

      <div>
        <label className="sp-label">{t('profiles.defaultServiceOptional')}</label>
        <select
          value={defaultService}
          onChange={e => setDefaultService(e.target.value)}
          className="sp-input text-xs"
        >
          <option value={ServiceType.DARSHAN}>{t('services.darshan')}</option>
          <option value={ServiceType.ARJITHA_SEVA}>{t('services.arjitha_seva')}</option>
          <option value={ServiceType.ACCOMMODATION}>{t('services.accommodation')}</option>
          <option value={ServiceType.SRIVANI}>{t('services.srivani')}</option>
          <option value={ServiceType.SRIVARI_SEVA}>{t('services.srivari_seva')}</option>
          <option value={ServiceType.ANGAPRADAKSHINAM}>{t('services.angapradakshinam')}</option>
          <option value={ServiceType.SENIOR_CITIZEN}>{t('services.senior_citizen')}</option>
        </select>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button onClick={handleSave} className="sp-btn-primary flex-1 min-h-[44px] text-xs">
          {t('common.save')}
        </button>
        <button onClick={onClose} className="sp-btn-secondary min-h-[44px] text-xs">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
