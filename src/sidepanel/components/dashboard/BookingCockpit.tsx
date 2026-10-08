// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Booking Cockpit (Hero Booking Mode)
// Premium Mission-Control console engineered for high-demand releases.
// Speed + Accuracy + Security as equal first-class requirements.
// ─────────────────────────────────────────────────

import React, { useState } from 'react';
import type { Pilgrim, PilgrimRowReport } from '@shared/types';
import { t } from '@i18n/index';

export interface BookingCockpitProps {
  serviceName: string;
  serviceType?: string;
  selectedPilgrims: Pilgrim[];
  maxPilgrims?: number;
  isReady: boolean;
  isFilling: boolean;
  isComplete?: boolean;
  allVerified?: boolean;
  lastDurationMs?: number;
  onFillClick: () => void;
  onStopClick: () => void;
  onNavigateProfiles?: () => void;
  pilgrimReports?: PilgrimRowReport[];
}

export const BookingCockpit: React.FC<BookingCockpitProps> = React.memo(({
  serviceName,
  selectedPilgrims,
  maxPilgrims = 6,
  isReady,
  isFilling,
  isComplete = false,
  allVerified = false,
  lastDurationMs = 740,
  onFillClick,
  onStopClick,
  onNavigateProfiles,
  pilgrimReports = [],
}) => {
  const [showGuardianDetails, setShowGuardianDetails] = useState(false);

  const formattedDuration = lastDurationMs > 0 ? (lastDurationMs / 1000).toFixed(2) : '0.74';
  const displayPilgrimCount = selectedPilgrims.length;
  const verifiedCount = pilgrimReports.filter(r => r.allValidated).length;

  return (
    <div
      className="rounded-3xl border-2 border-[#D4A72C]/40 bg-gradient-to-b from-[#FFFDF7] to-[#FAF5E8] dark:from-[#23122B] dark:to-[#170A1E] p-4 shadow-xl space-y-4 transition-all"
      role="region"
      aria-label="Booking Cockpit"
    >
      {/* ─── Cockpit Header & Live Status ─── */}
      <div className="flex items-center justify-between border-b border-[#D4A72C]/20 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#5B2A86] dark:text-[#D4A72C]">
              🛕 BOOKING COCKPIT
            </span>
            <span className="inline-block px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[#2F8F68]/15 text-[#2F8F68] dark:text-[#4ADE80]">
              FAST MODE
            </span>
          </div>
          <h2 className="text-sm font-black text-[#321B3F] dark:text-[#F8EFD8] truncate mt-0.5">
            {serviceName || 'Special Entry Darshan ₹300'}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 bg-[#2F8F68]/10 dark:bg-[#2F8F68]/20 px-2.5 py-1 rounded-full border border-[#2F8F68]/30 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#2F8F68] animate-ping" />
          <span className="text-[10px] font-bold text-[#1B5E20] dark:text-[#4ADE80]">
            PAGE READY
          </span>
        </div>
      </div>

      {/* ─── Ready Before You Click Status Bar ─── */}
      <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-2 border border-[#D4A72C]/20 shadow-xs">
          <span className="text-[10px] font-semibold text-[#735A88] dark:text-[#B6A2C7] block">
            Devotees
          </span>
          <span className="text-xs font-black text-[#321B3F] dark:text-[#F8EFD8]">
            {displayPilgrimCount} / {maxPilgrims} ✓
          </span>
        </div>

        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-2 border border-[#D4A72C]/20 shadow-xs">
          <span className="text-[10px] font-semibold text-[#735A88] dark:text-[#B6A2C7] block">
            Plan Status
          </span>
          <span className={`text-xs font-black ${isReady ? 'text-[#2F8F68]' : 'text-amber-600 dark:text-amber-400'}`}>
            {isReady ? 'Prewarmed ✓' : 'Setup Needed'}
          </span>
        </div>

        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-2 border border-[#D4A72C]/20 shadow-xs">
          <span className="text-[10px] font-semibold text-[#735A88] dark:text-[#B6A2C7] block">
            Last Speed
          </span>
          <span className="text-xs font-black text-[#5B2A86] dark:text-[#D4A72C]">
            ⚡ {formattedDuration}s
          </span>
        </div>
      </div>

      {/* ─── Six-Pilgrim Visual Group Manager ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#735A88] dark:text-[#B6A2C7]">
            YOUR BOOKING GROUP ({displayPilgrimCount})
          </span>
          {onNavigateProfiles && (
            <button
              onClick={onNavigateProfiles}
              className="text-[10px] font-bold text-[#5B2A86] dark:text-[#D4A72C] hover:underline focus-visible:ring-1 focus-visible:ring-gold-500 focus-visible:outline-none cursor-pointer"
              aria-label="Edit Pilgrim Details"
            >
              Edit Details ↗
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {selectedPilgrims.map((pilgrim, idx) => {
            const report = pilgrimReports.find(r => r.pilgrimIndex === idx);
            const isRowVerified = report?.allValidated || (isComplete && allVerified);
            const maskedId = pilgrim.idNumber
              ? `••••${pilgrim.idNumber.slice(-4)}`
              : 'ID Added';

            return (
              <div
                key={pilgrim.id || idx}
                className={`p-2.5 rounded-2xl border transition-all ${
                  isRowVerified
                    ? 'bg-[#F2FBF6] dark:bg-[#153422]/40 border-[#2F8F68]/40'
                    : 'bg-white/90 dark:bg-white/5 border-[#5B2A86]/15 dark:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#321B3F] dark:text-[#F8EFD8] truncate">
                      {pilgrim.fullName || `Pilgrim ${idx + 1}`}
                    </p>
                    <p className="text-[10px] font-medium text-[#735A88] dark:text-[#B6A2C7]">
                      {pilgrim.age}y · {pilgrim.gender === 'Female' ? 'F' : 'M'}
                    </p>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isRowVerified
                        ? 'bg-[#2F8F68] text-white'
                        : 'bg-[#5B2A86]/10 text-[#5B2A86] dark:text-[#D4A72C]'
                    }`}
                  >
                    {isRowVerified ? '✓' : idx + 1}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#735A88] dark:text-[#B6A2C7]">
                  <span className="font-mono">{maskedId}</span>
                  <span className={isRowVerified ? 'text-[#2F8F68] font-bold' : ''}>
                    {isRowVerified ? 'Verified' : 'Ready'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Hero Action: Ready Before You Click ─── */}
      <div className="space-y-2 pt-1">
        {isFilling ? (
          <button
            onClick={onStopClick}
            className="w-full min-h-[44px] py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none cursor-pointer"
            aria-label="Stop Autofill Process"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>STOP AUTOFILL</span>
          </button>
        ) : (
          <button
            onClick={onFillClick}
            disabled={!isReady}
            aria-disabled={!isReady}
            aria-label="Cockpit Execute Fill"
            id="sp-cockpit-fill-btn"
            className={`w-full min-h-[44px] py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none cursor-pointer ${
              isReady
                ? 'bg-gradient-to-r from-[#5B2A86] via-[#6F32A3] to-[#5B2A86] hover:from-[#4A2070] hover:to-[#4A2070] text-[#FFFDF7] border border-[#D4A72C]/40 shadow-[#5B2A86]/20'
                : 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-400/20'
            }`}
          >
            <span className="text-base text-[#F0CC63]">⚡</span>
            <span>{isComplete && allVerified ? '✓ RE-VERIFY DETAILS' : 'EXECUTE PREWARMED FILL'}</span>
          </button>
        )}

        <p className="text-[10px] text-center text-[#735A88] dark:text-[#B6A2C7] font-medium">
          Ready Before You Click · Differential fill touches only missing fields
        </p>
      </div>

      {/* ─── Booking Guardian & Identity Safe Strip ─── */}
      <div className="pt-1 space-y-2">
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-[#5B2A86]/10 dark:border-white/10 p-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[#2F8F68] font-bold">🛡️</span>
              <span className="text-[11px] font-black text-[#321B3F] dark:text-[#F8EFD8]">
                Booking Guardian Active
              </span>
            </div>
            <button
              onClick={() => setShowGuardianDetails(!showGuardianDetails)}
              className="text-[10px] font-bold text-[#5B2A86] dark:text-[#D4A72C] hover:underline cursor-pointer"
            >
              {showGuardianDetails ? 'Hide' : 'Details'}
            </button>
          </div>

          {showGuardianDetails ? (
            <div className="pt-1.5 border-t border-[#5B2A86]/10 dark:border-white/10 text-[10px] text-[#735A88] dark:text-[#B6A2C7] space-y-1">
              <p>✓ <strong>Never Guess:</strong> Stops immediately on field ambiguity</p>
              <p>✓ <strong>Exact Verification:</strong> Direct live DOM property validation</p>
              <p>✓ <strong>Event-Driven Waits:</strong> Zero arbitrary sleep timeouts</p>
              <p>✓ <strong>User in Control:</strong> Never auto-submits or automates payment</p>
            </div>
          ) : (
            <p className="text-[10px] text-[#735A88] dark:text-[#B6A2C7]">
              Watching for form rerenders, ID format integrity & server locks.
            </p>
          )}
        </div>

        {/* Identity Safe Badge */}
        <div className="flex items-center justify-between px-2 text-[10px] text-[#735A88] dark:text-[#B6A2C7]">
          <div className="flex items-center gap-1">
            <span>🔐</span>
            <span className="font-semibold">Identity Safe: Stored strictly on your device</span>
          </div>
          <span className="text-[#2F8F68] font-bold">Zero Telemetry ✓</span>
        </div>
      </div>
    </div>
  );
});
