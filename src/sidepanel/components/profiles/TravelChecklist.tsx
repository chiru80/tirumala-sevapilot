import React from 'react';
import type { Profile } from '@shared/types';

function maskIdDisplay(val?: string): string {
  if (!val) return '—';
  const clean = val.replace(/\s+/g, '');
  if (clean.length === 12) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  if (clean.length > 4) {
    return `•••• ${clean.slice(-4)}`;
  }
  return '••••';
}

function maskPhoneDisplay(val?: string): string {
  if (!val) return '—';
  const digits = val.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `••••••${digits.slice(-4)}`;
  }
  return '••••';
}

export interface TravelChecklistProps {
  slipProfile: Profile | null;
  onClose: () => void;
}

export function TravelChecklist({ slipProfile, onClose }: TravelChecklistProps) {
  if (!slipProfile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#FFFDF7] dark:bg-[#2C1A35] rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-gold-500/40 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between border-b border-gold-500/20 pb-2">
          <div>
            <h3 className="text-sm font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">Devotee Travel Checklist</h3>
            <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4]">{slipProfile.name} • {slipProfile.pilgrims.length} pilgrim(s)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B5A70] hover:text-[#5B2A86] dark:hover:text-[#F8EFD8]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {slipProfile.pilgrims.map((p, i) => (
            <div key={p.id} className="p-2 rounded-lg bg-cream/70 dark:bg-[#211526]/70 border border-gold-500/20 text-xs space-y-0.5">
              <div className="flex justify-between font-semibold">
                <span>{i + 1}. {p.fullName || `${p.firstName} ${p.lastName}`}</span>
                <span className="text-2xs text-[#5B2A86] dark:text-gold-400 font-bold">{p.gender} {p.age ? `• ${p.age}y` : ''}</span>
              </div>
              <div className="text-[10px] text-[#6B5A70] dark:text-[#A692B4] flex justify-between">
                <span>{p.idType}: {maskIdDisplay(p.idNumber)}</span>
                <span>📱 {maskPhoneDisplay(p.mobile)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-2.5 rounded-xl bg-gold-100/60 dark:bg-gold-950/40 border border-gold-400/40 text-[10px] text-gold-900 dark:text-gold-200 space-y-1">
          <p className="font-bold flex items-center gap-1 font-serif text-gold-800 dark:text-gold-300">
            <span>📋</span> Vaikuntam Queue Checklist
          </p>
          <ul className="list-disc pl-3.5 space-y-0.5">
            <li>Keep original Photo IDs ready for physical verification.</li>
            <li>Traditional Dress Code strictly mandatory in queue.</li>
            <li>Deposit electronic devices at luggage counter.</li>
          </ul>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => window.print()}
            className="sp-btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            <span>Print Devotee Slip</span>
          </button>
          <button
            onClick={onClose}
            className="sp-btn-secondary text-xs px-3"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
