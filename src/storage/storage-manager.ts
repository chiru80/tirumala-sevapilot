// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Storage Manager
// Unified local storage facade with strict zero-PII security
// ─────────────────────────────────────────────────

import {
  getProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  setDefaultProfile,
  duplicateProfile,
  addPilgrim,
  updatePilgrim,
  deletePilgrim,
  duplicatePilgrim,
  reorderPilgrims,
  updateSelectedPilgrims,
  getSettings,
  saveSettings,
} from './repository';
import type { Profile, Pilgrim, Settings } from '@shared/types';
import logger from '@shared/logger';

export class StorageManager {
  /** Get all pilgrims from default profile or specified profile */
  public static async getPilgrims(profileId?: string): Promise<Pilgrim[]> {
    if (profileId) {
      const p = await getProfile(profileId);
      return p?.pilgrims || [];
    }
    const profiles = await getProfiles();
    const active = profiles.find(p => p.isDefault) || profiles[0];
    return active?.pilgrims || [];
  }

  /** Save a new pilgrim into profile */
  public static async savePilgrim(
    profileId: string,
    pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Pilgrim> {
    logger.debug(`[StorageManager] Saving pilgrim record (PII masked)`);
    return addPilgrim(profileId, pilgrim);
  }

  /** Update an existing pilgrim */
  public static async updatePilgrim(
    profileId: string,
    pilgrimId: string,
    updates: Partial<Omit<Pilgrim, 'id' | 'createdAt'>>,
  ): Promise<Pilgrim> {
    logger.debug(`[StorageManager] Updating pilgrim record (PII masked)`);
    return updatePilgrim(profileId, pilgrimId, updates);
  }

  /** Delete a pilgrim */
  public static async deletePilgrim(profileId: string, pilgrimId: string): Promise<void> {
    logger.debug(`[StorageManager] Deleting pilgrim record`);
    return deletePilgrim(profileId, pilgrimId);
  }

  /** Duplicate a pilgrim within the profile */
  public static async duplicatePilgrim(profileId: string, pilgrimId: string): Promise<Pilgrim> {
    logger.debug(`[StorageManager] Duplicating pilgrim record`);
    return duplicatePilgrim(profileId, pilgrimId);
  }

  /** Reorder pilgrims */
  public static async reorderPilgrims(profileId: string, pilgrimIds: string[]): Promise<void> {
    return reorderPilgrims(profileId, pilgrimIds);
  }

  /** Get settings */
  public static async getSettings(): Promise<Settings> {
    return getSettings();
  }

  /** Save settings */
  public static async saveSettings(updates: Partial<Settings>): Promise<Settings> {
    return saveSettings(updates);
  }

  /** Export all user profiles and settings as a clean JSON backup */
  public static async exportJsonBackup(): Promise<{ filename: string; json: string }> {
    const profiles = await getProfiles();
    const settings = await getSettings();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `seva-pilot-backup-${dateStr}.json`;

    const data = {
      app: 'Tirumala SevaPilot',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profiles,
      settings,
    };

    return {
      filename,
      json: JSON.stringify(data, null, 2),
    };
  }
}
