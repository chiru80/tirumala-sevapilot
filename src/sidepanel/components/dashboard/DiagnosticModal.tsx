// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Developer Diagnostic Modal (Phase 4)
// Displays structural and operational telemetry for diagnostics.
// STRICT PRIVACY GUARANTEE: NEVER displays Aadhaar, ID numbers,
// mobile, email, or full profile data.
// ─────────────────────────────────────────────────────────────

import React from 'react';

export interface DiagnosticData {
  ttdDetected: boolean;
  serviceId?: string;
  serviceName?: string;
  workflowVersion?: string;
  currentStep?: string;
  rowsDetected: number;
  fieldsDetected: number;
  fieldsVerified: number;
  confidence: number;
  durationMs: number;
  failureReason?: string;
}

export interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DiagnosticData;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diag-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#18131E] border border-amber-500/30 rounded-xl shadow-2xl max-w-md w-full p-5 text-gray-100 font-mono text-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
            </svg>
            <h2 id="diag-title" className="font-semibold text-sm tracking-wide">
              SYSTEM DIAGNOSTICS
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Diagnostics"
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
          >
            <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Security / Privacy Banner */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded p-2.5 flex items-center gap-2 text-emerald-300">
          <svg className="w-4 h-4 shrink-0 text-emerald-400 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>ZERO-PII POLICY: Telemetry only. No profile data or IDs.</span>
        </div>

        {/* Metrics Grid */}
        <div className="space-y-2.5 bg-black/40 p-3 rounded-lg border border-gray-800/80">
          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">TTD Detected:</span>
            <span className={data.ttdDetected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {data.ttdDetected ? 'YES' : 'NO'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Service:</span>
            <span className="text-amber-300 font-medium">
              {data.serviceName || data.serviceId || 'Generic / Unrecognized'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Workflow Version:</span>
            <span className="text-purple-300">
              {data.workflowVersion || '1.0.0'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Current Step:</span>
            <span className="text-sky-300">
              {data.currentStep || 'UNKNOWN'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Rows Detected:</span>
            <span className="text-gray-200">{data.rowsDetected}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Fields Detected:</span>
            <span className="text-gray-200">{data.fieldsDetected}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Fields Verified:</span>
            <span className="text-emerald-400 font-semibold">{data.fieldsVerified}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Confidence:</span>
            <span className="text-amber-400 font-semibold">{data.confidence}%</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Duration:</span>
            <span className="text-gray-300">{data.durationMs}ms</span>
          </div>

          <div className="flex flex-col py-1">
            <span className="text-gray-400 mb-1">Failure Reason:</span>
            <span className={data.failureReason ? 'text-rose-400' : 'text-gray-500'}>
              {data.failureReason || 'None'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded font-sans text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
