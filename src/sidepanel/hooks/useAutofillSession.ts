import { useState, useEffect, useCallback } from 'react';
import { MessageType } from '@shared/types';
import type {
  Profile,
  Pilgrim,
  ScanResult,
  FieldMapping,
  PilgrimRowReport,
  AutofillMode,
} from '@shared/types';
import { recordSessionHistory, addNotification } from '@storage/repository';

export interface AutofillStageState {
  active: boolean;
  stage: 'preparing' | 'detecting' | 'loading' | 'filling' | 'validating' | 'complete';
  serviceDetected: boolean;
  profileLoaded: boolean;
  fieldsDetectedCount: number;
  fieldsFilledCount: number;
  validationComplete: boolean;
}

export interface UseAutofillSessionResult {
  isFilling: boolean;
  fillStatus: string | null;
  statusType: 'info' | 'success' | 'warning' | 'error';
  fillStage: AutofillStageState;
  currentProgressPilgrim: number;
  currentProgressField: string;
  pilgrimReports: PilgrimRowReport[];
  fieldResults: Array<{
    id: string;
    label: string;
    pilgrimKey: string;
    status: 'filled' | 'failed' | 'conflict' | 'skipped';
    error?: string;
    maskedValue?: string;
    mapping: FieldMapping;
  }>;
  executeFill: (
    pilgrims: Pilgrim[],
    profile: Profile,
    scanData: ScanResult,
    mode: AutofillMode,
    serviceName?: string,
    overridePilgrims?: Pilgrim[],
  ) => Promise<boolean>;
  handleEmergencyStop: () => Promise<void>;
  handleRepairMissing: (
    pilgrimsToRepair: Pilgrim[],
    profile: Profile,
    scanData: ScanResult,
    mode: AutofillMode,
    serviceName?: string,
  ) => Promise<boolean>;
  handleRetryField: (
    targetItem: any,
    pilgrims: Pilgrim[],
    profile: Profile,
    mode: AutofillMode,
  ) => Promise<void>;
  handleRetryAllFailed: (
    pilgrims: Pilgrim[],
    profile: Profile,
    mode: AutofillMode,
  ) => Promise<void>;
  resetSession: () => void;
  setFillStatus: (status: string | null) => void;
}

export function useAutofillSession(): UseAutofillSessionResult {
  const [isFilling, setIsFilling] = useState<boolean>(false);
  const [fillStatus, setFillStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const [fillStage, setFillStage] = useState<AutofillStageState>({
    active: false,
    stage: 'preparing',
    serviceDetected: false,
    profileLoaded: false,
    fieldsDetectedCount: 0,
    fieldsFilledCount: 0,
    validationComplete: false,
  });

  const [currentProgressPilgrim, setCurrentProgressPilgrim] = useState<number>(1);
  const [currentProgressField, setCurrentProgressField] = useState<string>('Name');
  const [pilgrimReports, setPilgrimReports] = useState<PilgrimRowReport[]>([]);
  const [fieldResults, setFieldResults] = useState<Array<{
    id: string;
    label: string;
    pilgrimKey: string;
    status: 'filled' | 'failed' | 'conflict' | 'skipped';
    error?: string;
    maskedValue?: string;
    mapping: FieldMapping;
  }>>([]);

  // Listen to runtime progress updates
  useEffect(() => {
    const listener = (message: { type: string; payload: any }) => {
      if (message.type === MessageType.AUTOFILL_PROGRESS) {
        const prog = message.payload;
        if (prog) {
          if (prog.pilgrimIndex !== undefined) {
            setCurrentProgressPilgrim(prog.pilgrimIndex + 1);
          }
          if (prog.field || prog.currentField) {
            setCurrentProgressField(prog.field || prog.currentField);
          }
          if (prog.currentField) {
            setFillStatus(`Filling & verifying: ${prog.currentField}...`);
          }
          if (prog.pilgrimResults && Array.isArray(prog.pilgrimResults)) {
            const verified = prog.pilgrimResults.reduce((acc: number, p: any) => acc + (p.fieldsVerified || 0), 0);
            const total = prog.pilgrimResults.length * 5;
            setFillStage(prev => ({
              ...prev,
              fieldsFilledCount: verified,
              fieldsDetectedCount: total,
            }));
          }
        }
      }
    };

    chrome.runtime?.onMessage?.addListener(listener);
    return () => {
      chrome.runtime?.onMessage?.removeListener(listener);
    };
  }, []);

  const executeFill = useCallback(async (
    pilgrims: Pilgrim[],
    profile: Profile,
    scanData: ScanResult,
    mode: AutofillMode,
    serviceName: string = 'Special Entry Darshan',
    overridePilgrims?: Pilgrim[],
  ): Promise<boolean> => {
    const targetPilgrims = overridePilgrims || pilgrims;
    if (targetPilgrims.length === 0) {
      setFillStatus('No devotees selected to fill.');
      setStatusType('warning');
      return false;
    }

    setIsFilling(true);
    setFillStage({
      active: true,
      stage: 'preparing',
      serviceDetected: true,
      profileLoaded: true,
      fieldsDetectedCount: scanData.mappedFields?.length || targetPilgrims.length * 5,
      fieldsFilledCount: 0,
      validationComplete: false,
    });
    setFillStatus(`Filling & verifying details for ${targetPilgrims.length} devotee(s)...`);
    setStatusType('info');

    const fillStartTime = performance.now();

    try {
      setFillStage(prev => ({ ...prev, stage: 'filling' }));

      let targetTabId: number | undefined;
      if (chrome.tabs) {
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) {
          [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        targetTabId = tab?.id;
      }

      const fillResponse = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_FILL,
        targetTabId,
        payload: {
          targetTabId,
          pilgrims: targetPilgrims,
          profile,
          mappings: scanData.mappedFields,
          mode,
        },
        timestamp: new Date().toISOString(),
      });

      const fillDuration = Math.round(performance.now() - fillStartTime);

      if (fillResponse?.success) {
        const results = (fillResponse.data as any[]) || [];
        const newReports: PilgrimRowReport[] = fillResponse.pilgrimReports || fillResponse.stepResult?.pilgrimReport?.pilgrimReports || [];

        if (overridePilgrims && overridePilgrims.length < pilgrims.length) {
          setPilgrimReports(prev => {
            const updated = [...prev];
            for (const nr of newReports) {
              const idx = updated.findIndex(u => u.pilgrimIndex === nr.pilgrimIndex);
              if (idx !== -1) {
                updated[idx] = nr;
              } else {
                updated.push(nr);
              }
            }
            return updated;
          });
        } else {
          setPilgrimReports(newReports);
        }

        const filled = results.filter(r => r.status === 'filled').length;
        const failed = results.filter(r => r.status === 'failed').length;

        const items = results.map((r, i) => {
          const pKey = r.field?.pilgrimKey || 'field';
          const label = r.field?.scannedField?.label || pKey;
          const masked = pKey === 'idNumber' ? '••••' + String(r.newValue || '').slice(-4) : (r.newValue || '');
          return {
            id: `field_${i}_${pKey}`,
            label: String(label).replace(/[\*\:]/g, '').trim(),
            pilgrimKey: pKey,
            status: r.status as 'filled' | 'failed' | 'conflict' | 'skipped',
            error: r.error || (r.status === 'failed' ? `Could not populate ${label}` : undefined),
            maskedValue: masked,
            mapping: r.field,
          };
        });
        setFieldResults(items);

        setFillStage(prev => ({
          ...prev,
          stage: 'complete',
          fieldsFilledCount: filled,
          validationComplete: true,
        }));

        await recordSessionHistory({
          serviceType: scanData.serviceType,
          serviceName,
          pilgrimCount: targetPilgrims.length,
          fieldsFilled: filled,
          fieldsTotal: results.length,
          status: failed === 0 ? 'completed' : 'partial',
          durationMs: fillDuration,
        }).catch(() => {});

        if (failed === 0) {
          setFillStatus(`Autofill complete — all details verified in ${fillDuration}ms.`);
          setStatusType('success');
          addNotification({
            type: 'success',
            title: 'Autofill & Verification Complete',
            message: `Filled and verified ${filled} fields for ${targetPilgrims.length} devotees in ${serviceName}.`,
          }).catch(() => {});
          return true;
        } else {
          setFillStatus(`${failed} field(s) require attention. Use repair below.`);
          setStatusType('warning');
          addNotification({
            type: 'warning',
            title: 'Verification Notice',
            message: `${failed} field(s) require attention.`,
          }).catch(() => {});
          return false;
        }
      } else {
        setFillStage(prev => ({ ...prev, active: false }));
        setFillStatus(`Fill failed: ${fillResponse?.error || 'Unknown error'}`);
        setStatusType('error');
        return false;
      }
    } catch {
      setFillStage(prev => ({ ...prev, active: false }));
      setFillStatus('Communication error with TTD page. Try refreshing the page.');
      setStatusType('error');
      return false;
    } finally {
      setIsFilling(false);
    }
  }, []);

  const handleEmergencyStop = useCallback(async () => {
    try {
      let targetTabId: number | undefined;
      if (chrome.tabs) {
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) {
          [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        targetTabId = tab?.id;
      }
      await chrome.runtime.sendMessage({
        type: MessageType.STOP_AUTOFILL,
        targetTabId,
        payload: { targetTabId },
        timestamp: new Date().toISOString(),
      });
      setFillStatus('Autofill stopped by user.');
      setStatusType('warning');
      setIsFilling(false);
    } catch {
      setIsFilling(false);
    }
  }, []);

  const handleRepairMissing = useCallback(async (
    allSelectedPilgrims: Pilgrim[],
    profile: Profile,
    scanData: ScanResult,
    mode: AutofillMode,
    serviceName?: string,
  ): Promise<boolean> => {
    // Collect ONLY unvalidated fields across all devotee reports
    const targetFailedItems: Array<{ pilgrimIndex: number; field: string }> = [];
    for (const report of pilgrimReports) {
      if (!report.allValidated) {
        for (const [key, field] of Object.entries(report.fields)) {
          if (!field.validated) {
            targetFailedItems.push({ pilgrimIndex: report.pilgrimIndex, field: key });
          }
        }
      }
    }

    if (targetFailedItems.length === 0) {
      setFillStatus('No unverified fields to repair.');
      return true;
    }

    setIsFilling(true);
    setFillStatus(`Repairing ${targetFailedItems.length} unverified field(s)...`);
    setStatusType('info');

    try {
      let targetTabId: number | undefined;
      if (chrome.tabs) {
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) {
          [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        targetTabId = tab?.id;
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_FILL,
        targetTabId,
        payload: {
          targetTabId,
          pilgrims: allSelectedPilgrims,
          profile,
          mode,
          onlyRepairFailed: true,
          targetFailedItems,
        },
        timestamp: new Date().toISOString(),
      });

      if (response?.success) {
        if (response.pilgrimReports) {
          setPilgrimReports(response.pilgrimReports);
        }
        const failedRemaining = response.pilgrimReports?.filter((p: any) => !p.allValidated)?.length || 0;
        if (failedRemaining === 0) {
          setFillStatus('All missing fields successfully repaired and verified!');
          setStatusType('success');
          return true;
        } else {
          setFillStatus(`${failedRemaining} devotee(s) still have unverified fields.`);
          setStatusType('warning');
          return false;
        }
      } else {
        setFillStatus(`Repair failed: ${response?.error || 'Unable to repair'}`);
        setStatusType('error');
        return false;
      }
    } catch {
      setFillStatus('Communication error during repair.');
      setStatusType('error');
      return false;
    } finally {
      setIsFilling(false);
    }
  }, [pilgrimReports]);

  const handleRetryField = useCallback(async (
    targetItem: any,
    pilgrims: Pilgrim[],
    profile: Profile,
    mode: AutofillMode,
  ) => {
    const fieldKey = targetItem.pilgrimKey || targetItem.fieldKey || targetItem.field;
    const pilgrimIndex = targetItem.pilgrimIndex !== undefined ? targetItem.pilgrimIndex : 0;
    const label = targetItem.label || fieldKey;

    setFillStatus(`Retrying field: ${label}...`);
    setStatusType('info');

    try {
      let targetTabId: number | undefined;
      if (chrome.tabs) {
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) {
          [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        targetTabId = tab?.id;
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_FILL,
        targetTabId,
        payload: {
          targetTabId,
          pilgrims,
          profile,
          mode,
          onlyRepairFailed: true,
          targetFailedItems: [{ pilgrimIndex, field: fieldKey }],
        },
        timestamp: new Date().toISOString(),
      });

      if (response?.success && response.pilgrimReports) {
        setPilgrimReports(response.pilgrimReports);
        const pilgrimRep = response.pilgrimReports.find((p: any) => p.pilgrimIndex === pilgrimIndex);
        const fieldRep = pilgrimRep?.fields?.[fieldKey];
        if (fieldRep?.validated) {
          setFillStatus(`Field "${label}" successfully repaired & verified.`);
          setStatusType('success');
        } else {
          setFillStatus(`Retry for "${label}" did not verify.`);
          setStatusType('warning');
        }
      }
    } catch {
      setFillStatus(`Failed to retry field ${label}`);
      setStatusType('error');
    }
  }, []);

  const handleRetryAllFailed = useCallback(async (
    pilgrims: Pilgrim[],
    profile: Profile,
    mode: AutofillMode,
  ) => {
    const failedFields = fieldResults.filter(f => f.status === 'failed' || f.status === 'conflict');
    if (failedFields.length === 0) return;

    setFillStatus(`Retrying ${failedFields.length} failed field(s)...`);
    setStatusType('info');

    try {
      let targetTabId: number | undefined;
      if (chrome.tabs) {
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) {
          [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        targetTabId = tab?.id;
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_FILL,
        targetTabId,
        payload: {
          targetTabId,
          pilgrims,
          profile,
          mappings: failedFields.map(f => f.mapping),
          mode,
        },
        timestamp: new Date().toISOString(),
      });

      if (response?.success) {
        const results = (response.data as any[]) || [];
        const newlyFilledKeys = new Set(results.filter(r => r.status === 'filled').map(r => r.field?.pilgrimKey));
        setFieldResults(prev => prev.map(f => {
          if (newlyFilledKeys.has(f.pilgrimKey)) {
            return { ...f, status: 'filled', error: undefined };
          }
          return f;
        }));
        setFillStatus(`Retry complete: Processed ${results.length} fields.`);
        setStatusType('success');
      }
    } catch {
      setFillStatus('Error during retry all operation.');
      setStatusType('error');
    }
  }, [fieldResults]);

  const resetSession = useCallback(() => {
    setFieldResults([]);
    setPilgrimReports([]);
    setFillStatus(null);
    setFillStage({
      active: false,
      stage: 'preparing',
      serviceDetected: false,
      profileLoaded: false,
      fieldsDetectedCount: 0,
      fieldsFilledCount: 0,
      validationComplete: false,
    });
  }, []);

  return {
    isFilling,
    fillStatus,
    statusType,
    fillStage,
    currentProgressPilgrim,
    currentProgressField,
    pilgrimReports,
    fieldResults,
    executeFill,
    handleEmergencyStop,
    handleRepairMissing,
    handleRetryField,
    handleRetryAllFailed,
    resetSession,
    setFillStatus,
  };
}
