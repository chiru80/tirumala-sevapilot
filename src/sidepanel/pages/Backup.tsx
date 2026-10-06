import React, { useState } from 'react';
import { getProfiles, validateImportPayload, importProfilesSafely } from '@storage/repository';
import { createBackup, restoreBackup, downloadBackup, readBackupFile } from '@security/backup';
import type { BackupFile, Profile } from '@shared/types';
import { TempleDivider } from '../components/TempleDivider';
import { StorageManager } from '../../storage/storage-manager';
import { t } from '@i18n/index';

export function Backup() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // JSON safe import preview state
  const [importPreview, setImportPreview] = useState<{
    profiles: Profile[];
    summary: { profileCount: number; pilgrimCount: number };
  } | null>(null);

  async function handleExportJson() {
    try {
      setLoading(true);
      const { filename, json } = await StorageManager.exportJsonBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: `Downloaded JSON backup: ${filename}` });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!password) {
      setStatus({ type: 'error', message: 'Please enter an encryption password for the backup.' });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    try {
      setLoading(true);
      const profiles = await getProfiles();
      if (profiles.length === 0) {
        setStatus({ type: 'error', message: 'No profiles to backup.' });
        return;
      }
      const backup = await createBackup(profiles, password);
      downloadBackup(backup);
      setStatus({ type: 'success', message: 'Encrypted backup downloaded successfully (.spbk)!' });
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStatus(null);
      setImportPreview(null);

      // If it's a JSON file, trigger Step 1 & 2: Parse & Validate Schema
      if (file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const validation = validateImportPayload(parsed);

          if (!validation.valid || !validation.profiles || !validation.summary) {
            setStatus({ type: 'error', message: validation.error || 'Invalid profile JSON structure.' });
            return;
          }

          // Step 3: Show preview
          setImportPreview({
            profiles: validation.profiles,
            summary: validation.summary,
          });
        } catch {
          setStatus({ type: 'error', message: 'Failed to parse JSON file. File may be corrupted.' });
        }
      }
    }
  }

  async function handleConfirmJsonImport() {
    if (!importPreview) return;
    try {
      setLoading(true);
      // Step 4 & 5: Auto-backup and Import
      const res = await importProfilesSafely(importPreview.profiles);
      setStatus({
        type: 'success',
        message: `Successfully imported ${res.importedCount} profile(s) (${importPreview.summary.pilgrimCount} devotees)! An automatic local backup was created.`,
      });
      setImportPreview(null);
      setSelectedFile(null);
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Please select a .spbk or .json file to restore.' });
      return;
    }

    if (selectedFile.name.endsWith('.json')) {
      handleConfirmJsonImport();
      return;
    }

    if (!restorePassword) {
      setStatus({ type: 'error', message: 'Please enter the backup encryption password.' });
      return;
    }

    try {
      setLoading(true);
      const backupData: BackupFile = await readBackupFile(selectedFile);
      const restoredProfiles = await restoreBackup(backupData, restorePassword);

      const res = await importProfilesSafely(restoredProfiles);

      setStatus({
        type: 'success',
        message: `Successfully restored ${res.importedCount} profile(s) from encrypted backup!`,
      });
      setSelectedFile(null);
      setRestorePassword('');
    } catch (err: unknown) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in text-[#321B3F] dark:text-[#F8EFD8]">
      <div>
        <h2 className="text-xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">
          {t('backup.title')}
        </h2>
        <p className="text-sm text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
          Zero-telemetry AES-GCM-256 encrypted .spbk export & safe JSON import
        </p>
      </div>

      <TempleDivider variant="compact" />

      {status && (
        <div
          className={`p-3 rounded-xl text-sm border ${
            status.type === 'success'
              ? 'bg-[#EBF5F0] dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-[#1E573F] dark:text-emerald-200'
              : status.type === 'warning'
              ? 'bg-[#FFF8E8] dark:bg-[#3D2F1B] border-[#D4A72C] text-[#8D6E18] dark:text-[#FFE082]'
              : 'bg-[#FDF2F2] dark:bg-red-950/40 border-red-300 dark:border-red-800 text-temple-red'
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Export Section */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🛡️</span>
          <h3 className="text-base font-serif font-bold text-[#5B2A86] dark:text-[#F8EFD8]">
            {t('backup.exportBackup')} (.spbk)
          </h3>
        </div>
        <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] leading-relaxed">
          {t('backup.exportDescription')} using AES-GCM-256 with PBKDF2 (600,000 iterations).
        </p>

        <div>
          <label className="sp-label text-sm mb-1">{t('backup.password')}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Choose a strong password"
            className="sp-input text-base"
          />
        </div>

        <div>
          <label className="sp-label text-sm mb-1">{t('backup.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="sp-input text-base"
          />
        </div>

        <button
          onClick={handleExport}
          disabled={loading || !password || password !== confirmPassword}
          className="sp-btn-primary w-full min-h-[44px] text-sm py-2.5 mt-1"
        >
          {loading ? 'Encrypting & Generating .spbk...' : 'Download Encrypted Backup (.spbk)'}
        </button>

        <div className="pt-2.5 border-t border-gold-500/20 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#5B2A86] dark:text-[#F0CC63]">Standard JSON Export</div>
            <div className="text-xs text-[#6B5A70] dark:text-[#A692B4]">Direct backup for migration (seva-pilot-backup-*.json)</div>
          </div>
          <button
            onClick={handleExportJson}
            disabled={loading}
            className="sp-btn-secondary min-h-[44px] text-sm py-2 px-3.5 shrink-0 cursor-pointer"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Restore & Safe Import Section */}
      <div className="sp-card bg-cream/40 dark:bg-[#2D1A38] border-gold-500/25 space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📥</span>
          <h3 className="text-base font-serif font-bold text-[#5B2A86] dark:text-[#F8EFD8]">
            {t('backup.importBackup')} (.spbk / .json)
          </h3>
        </div>
        <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] leading-relaxed">
          {t('backup.importDescription')}. An automatic internal backup is created before applying.
        </p>

        <input
          type="file"
          accept=".spbk,.json"
          onChange={handleFileSelect}
          className="block w-full text-xs text-[#6B5A70] dark:text-[#A692B4] file:mr-2.5 file:py-2 file:px-3.5 file:rounded-xl file:border file:border-gold-500/30 file:text-xs file:font-semibold file:bg-white dark:file:bg-[#321B3F] file:text-[#5B2A86] dark:file:text-gold-300 hover:file:bg-gold-50 cursor-pointer"
        />

        {/* JSON Preview Modal / Confirmation Card */}
        {importPreview && (
          <div className="p-3.5 bg-[#FFFDF7] dark:bg-[#211526] border-2 border-[#D4A72C] rounded-xl space-y-2 animate-slide-up">
            <div className="flex items-center justify-between text-sm font-bold text-[#5B2A86] dark:text-[#F0CC63]">
              <span>✦ Import Preview Ready</span>
              <span>{importPreview.summary.profileCount} Profile(s)</span>
            </div>
            <p className="text-xs text-[#6B5A70] dark:text-[#A898B0] leading-relaxed">
              Detected {importPreview.summary.pilgrimCount} devotee(s) across {importPreview.summary.profileCount} squad(s). Existing local data will be automatically backed up before merging.
            </p>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={handleConfirmJsonImport}
                disabled={loading}
                className="sp-btn-primary flex-1 min-h-[44px] text-sm py-2"
              >
                {loading ? 'Importing...' : 'Confirm & Import Safely'}
              </button>
              <button
                onClick={() => setImportPreview(null)}
                className="sp-btn-secondary min-h-[44px] text-sm px-4"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {selectedFile && selectedFile.name.endsWith('.spbk') && (
          <div>
            <label className="sp-label text-sm mb-1">Decryption Password</label>
            <input
              type="password"
              value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              placeholder="Enter backup password"
              className="sp-input text-base"
            />
          </div>
        )}

        {(!importPreview || !selectedFile?.name.endsWith('.json')) && (
          <button
            onClick={handleRestore}
            disabled={loading || !selectedFile}
            className="sp-btn-secondary w-full min-h-[44px] text-sm py-2.5"
          >
            {loading ? 'Processing...' : 'Restore Devotee Records'}
          </button>
        )}
      </div>
    </div>
  );
}
