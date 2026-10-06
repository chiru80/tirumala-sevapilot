import React, { useState, useEffect } from 'react';
import { t } from '@i18n/index';
import {
  getProfiles,
  createProfile,
  deleteProfile,
  duplicateProfile,
  setDefaultProfile,
  addPilgrim,
  deletePilgrim,
  updatePilgrim,
  duplicatePilgrim,
  updateSelectedPilgrims,
} from '@storage/repository';
import type { Profile, Pilgrim } from '@shared/types';
import { TempleDivider } from '../TempleDivider';
import { ProfileCard } from './ProfileCard';
import { ProfileCreateModal } from './ProfileCreateModal';
import { PilgrimEditorModal } from './PilgrimEditor';
import { TravelChecklist } from './TravelChecklist';

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPilgrim, setShowAddPilgrim] = useState<string | null>(null);
  const [editPilgrim, setEditPilgrim] = useState<{ profileId: string; pilgrim: Pilgrim } | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [slipProfile, setSlipProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const p = await getProfiles();
      setProfiles(p);
    } catch {
      /* graceful fallback */
    }
  }

  async function handleCreateProfile(name: string, description?: string, defaultService?: string) {
    await createProfile(name, description, defaultService);
    setShowCreate(false);
    loadProfiles();
  }

  async function handleDeleteProfile(id: string) {
    if (confirm(t('profiles.deleteProfile') + '?')) {
      await deleteProfile(id);
      loadProfiles();
    }
  }

  async function handleDuplicateProfile(id: string) {
    try {
      const copy = await duplicateProfile(id);
      await loadProfiles();
      setExpandedProfile(copy.id);
    } catch (e: any) {
      alert(e?.message || t('profiles.duplicateFailed'));
    }
  }

  async function handleSetDefaultProfile(id: string) {
    await setDefaultProfile(id);
    await loadProfiles();
  }

  async function handleDuplicateDevotee(profileId: string, pilgrimId: string) {
    try {
      await duplicatePilgrim(profileId, pilgrimId);
      await loadProfiles();
    } catch (e: any) {
      alert(e?.message || t('profiles.duplicateDevoteeFailed'));
    }
  }

  async function handleDeleteDevotee(profileId: string, pilgrimId: string) {
    if (confirm(t('profiles.deleteConfirm'))) {
      await deletePilgrim(profileId, pilgrimId);
      await loadProfiles();
    }
  }

  async function handleToggleSelectAll(profile: Profile) {
    const allIds = profile.pilgrims.map(p => p.id);
    const current = profile.selectedPilgrims?.['darshan'] ?? allIds;
    const next = current.length === allIds.length ? [] : allIds;
    await updateSelectedPilgrims(profile.id, 'darshan', next);
    await loadProfiles();
  }

  function handlePrintSlip(profile: Profile) {
    setSlipProfile(profile);
  }

  async function handleAddPilgrim(profileId: string, pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>) {
    await addPilgrim(profileId, pilgrim);
    setShowAddPilgrim(null);
    loadProfiles();
  }

  async function handleSaveDevotee(updatedPilgrim: Pilgrim) {
    if (!editPilgrim) return;
    await updatePilgrim(editPilgrim.profileId, updatedPilgrim.id, updatedPilgrim);
    setEditPilgrim(null);
    await loadProfiles();
  }

  return (
    <div className="p-4 space-y-3.5 animate-fade-in text-[#321B3F] dark:text-[#F8EFD8]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">{t('profiles.title')}</h2>
          <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">{t('profiles.manageGroups')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="sp-btn-primary min-h-[44px] text-xs py-2 px-3.5">
          <svg className="w-4 h-4 text-gold-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4"/></svg>
          <span>{t('profiles.createProfile')}</span>
        </button>
      </div>

      <TempleDivider variant="compact" />

      {/* Create Profile Form Modal */}
      <ProfileCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateProfile}
      />

      {/* Profile List */}
      {profiles.length === 0 ? (
        <div className="text-center py-8 px-4 bg-cream/40 dark:bg-[#2D1A38]/40 rounded-2xl border border-dashed border-gold-500/30">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-600 dark:text-gold-400">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <p className="text-xs font-serif font-bold text-[#5B2A86] dark:text-[#F8EFD8]">{t('profiles.noProfiles')}</p>
          <p className="text-2xs text-[#8B7D8F] mt-1">{t('profiles.createFirst')}</p>
        </div>
      ) : (
        profiles.map(profile => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isSelected={profile.isDefault}
            isExpanded={expandedProfile === profile.id}
            onToggleExpand={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
            onSetDefault={handleSetDefaultProfile}
            onPrintSlip={handlePrintSlip}
            onDuplicateProfile={handleDuplicateProfile}
            onDeleteProfile={handleDeleteProfile}
            onToggleSelectAll={handleToggleSelectAll}
            onEditPilgrim={(profileId, pilgrim) => setEditPilgrim({ profileId, pilgrim })}
            onDuplicatePilgrim={handleDuplicateDevotee}
            onDeletePilgrim={handleDeleteDevotee}
            onAddPilgrim={handleAddPilgrim}
            showAddPilgrim={showAddPilgrim === profile.id}
            onSetShowAddPilgrim={(show) => setShowAddPilgrim(show ? profile.id : null)}
            onRefresh={loadProfiles}
          />
        ))
      )}

      {/* 5-Section Pilgrim Editor Modal */}
      {editPilgrim && (
        <PilgrimEditorModal
          editPilgrim={editPilgrim}
          onClose={() => setEditPilgrim(null)}
          onSave={handleSaveDevotee}
        />
      )}

      {/* Devotee Queue & Verification Travel Checklist / Print Slip Modal */}
      <TravelChecklist
        slipProfile={slipProfile}
        onClose={() => setSlipProfile(null)}
      />
    </div>
  );
}
