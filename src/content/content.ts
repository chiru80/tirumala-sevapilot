// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Content Script Entry Point (Phase 3)
// Multi-signal service detection, change tracking, field highlighter
// ─────────────────────────────────────────────────

import { ServiceRecognitionEngine } from '@services/service-recognition-engine';
import { scanForm } from './form-scanner';
import { FieldMappingEngine } from './field-mapping-engine';
import { FormChangeDetector } from './form-change-detector';
import { FieldHighlighter } from './field-highlighter';
import { createPageObserver, stopPageObserver } from './mutation-observer';
import { getPageState, updatePageState } from './page-state';
import { injectFloatingHelper } from './floating-helper';
import { AngularFormObserver } from './angular-form-observer';
// Legacy ttd-pilgrim-autofill is no longer imported — all autofill goes through autofill-manager
import { executeAutofill, repairFailedFields, requestStop } from './autofill/autofill-manager';
import { detectTtdTemporaryLock } from '@services/ttd-information/ttd-lock-detector';
import { bookingGuardian } from '@services/guardian';
import { STORAGE_KEYS } from '@shared/constants';
import { MessageType, ServiceType } from '@shared/types';
import type { ExtensionMessage, Pilgrim, Profile, FieldMapping, ScanResult, AutofillMode } from '@shared/types';
import logger from '@shared/logger';

logger.info('SevaPilot content script loaded');

// Multi-signal detection
const recognition = ServiceRecognitionEngine.recognize(window.location.href, document);

if (recognition.status !== 'not-detected') {
  const initLock = detectTtdTemporaryLock(document, window.location.href);
  const guardianEval = bookingGuardian.evaluateState({
    doc: document,
    url: window.location.href,
    explicitServiceId: recognition.serviceId,
  });

  updatePageState({
    url: window.location.href,
    isSupported: true,
    serviceType: recognition.serviceType,
    serviceId: recognition.serviceId,
    serviceName: recognition.serviceName,
    workflowId: recognition.workflowId,
    serviceConfidence: recognition.confidenceScore,
    formDetected: document.querySelectorAll('input:not([type="hidden"]), select').length > 0,
    fieldCount: document.querySelectorAll('input:not([type="hidden"]), select').length,
    temporaryLock: initLock.isLocked && initLock.lockState ? initLock.lockState : undefined,
    guardianState: guardianEval.guardianState,
    guardianStage: guardianEval.pageDetection.stage,
  });

  logger.info(`TTD service detected: ${recognition.serviceName} (${recognition.confidenceScore}% confidence)`);

  // Inject on-page floating assistant
  try {
    injectFloatingHelper();
  } catch (err) {
    logger.debug('Floating helper injection error:', err);
  }

  // Notify background
  chrome.runtime.sendMessage({
    type: MessageType.PAGE_DETECTED,
    payload: {
      type: recognition.serviceType,
      serviceType: recognition.serviceType,
      serviceId: recognition.serviceId,
      workflowId: recognition.workflowId,
      confidence: recognition.confidenceScore,
      name: recognition.serviceName,
      status: recognition.status,
      signals: recognition.signals,
    },
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}

import { DomLifecycleEngine } from './dom-lifecycle';
import { bookingSessionManager } from './autofill/booking-session';
import { isValidExtensionMessage } from '@shared/message-security';

// Start mutation observer for SPA navigation and dynamic DOM mutations
const observer = createPageObserver(() => {
  const currentRec = ServiceRecognitionEngine.recognize(window.location.href, document);
  if (currentRec.status !== 'not-detected') {
    const inputCount = document.querySelectorAll('input:not([type="hidden"]), select').length;
    updatePageState({
      url: window.location.href,
      isSupported: true,
      serviceType: currentRec.serviceType,
      serviceId: currentRec.serviceId,
      serviceName: currentRec.serviceName,
      workflowId: currentRec.workflowId,
      serviceConfidence: currentRec.confidenceScore,
      formDetected: inputCount > 0,
      fieldCount: inputCount,
    });
  }
});

// Phase 6: Scoped DOM Lifecycle Engine
const domLifecycle = new DomLifecycleEngine({ debounceMs: 50 });
domLifecycle.subscribe((event) => {
  logger.debug(`[DOM Lifecycle] ${event.type}:`, event.details);
  if (event.type === 'STEP_CHANGED') {
    const currentRec = ServiceRecognitionEngine.recognize(window.location.href, document);
    if (currentRec.status !== 'not-detected') {
      updatePageState({
        url: window.location.href,
        isSupported: true,
        serviceType: currentRec.serviceType,
        serviceId: currentRec.serviceId,
        serviceName: currentRec.serviceName,
        workflowId: currentRec.workflowId,
        serviceConfidence: currentRec.confidenceScore,
      });
    }
  }
});
domLifecycle.start(document.body || document.documentElement);


// Phase 6: User Value Protection
document.addEventListener('input', (e) => {
  if (!e.isTrusted) return; // Only track real human DOM interaction
  const target = e.target as HTMLElement;
  const nameOrId = target.getAttribute('name') || target.getAttribute('formcontrolname') || target.id;
  if (nameOrId) {
    const rowEl = target.closest('tr, .pilgrim-card, .devotee-card, .mat-card');
    const index = rowEl ? Array.from(rowEl.parentElement?.children || []).indexOf(rowEl) : undefined;
    bookingSessionManager.recordUserModifiedField(nameOrId, index);
  }
}, { capture: true, passive: true });

// Phase 4/6 Cleanup: Ensure complete cleanup on tab navigation / unload
window.addEventListener('beforeunload', () => {
  domLifecycle.stop();
  stopPageObserver(observer);
  requestStop();
});

// Listen for messages from background/sidepanel with message security verification
chrome.runtime.onMessage.addListener(
  (rawMessage: unknown, _sender, sendResponse) => {
    if (!isValidExtensionMessage(rawMessage)) {
      logger.warn('Rejected malformed or invalid extension message');
      sendResponse({ success: false, error: 'Malformed message rejected' });
      return false;
    }
    handleMessage(rawMessage, sendResponse);
    return true; // Keep channel open for async response
  },
);


async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    switch (message.type) {
      case MessageType.SCAN_PAGE: {
        const scannedFields = scanForm(document);
        const mappedResult = FieldMappingEngine.map(scannedFields);
        const state = getPageState();

        // Check for website form changes
        const changeReport = FormChangeDetector.compare(
          state.serviceType || ServiceType.DARSHAN,
          scannedFields,
        );

        if (changeReport.hasChanged) {
          logger.warn('Form change detected:', changeReport.message);
          chrome.runtime.sendMessage({
            type: MessageType.FORM_CHANGED,
            payload: changeReport,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }

        const lockCheck = detectTtdTemporaryLock(document, window.location.href);
        const scanResult: ScanResult = {
          serviceType: state.serviceType ?? ServiceType.GENERIC,
          serviceId: state.serviceId ?? recognition.serviceId,
          workflowId: state.workflowId ?? recognition.workflowId,
          serviceConfidence: state.serviceConfidence ?? 0,
          url: window.location.href,
          totalFields: scannedFields.length,
          mappedFields: mappedResult.allMapped.filter(m => m.pilgrimKey !== null),
          unmappedFields: mappedResult.unmapped,
          pilgrimCardCount: mappedResult.groupCount,
          formFingerprint: generateFingerprint(scannedFields),
          timestamp: new Date().toISOString(),
          temporaryLock: lockCheck.isLocked && lockCheck.lockState ? lockCheck.lockState : undefined,
        };

        updatePageState({
          ...state,
          formDetected: scannedFields.length > 0,
          fieldCount: scannedFields.length,
          lastScan: scanResult,
          temporaryLock: scanResult.temporaryLock,
        });

        sendResponse({ success: true, data: scanResult });
        break;
      }

      case MessageType.FILL_FIELDS: {
        const payload = (message?.payload || {}) as {
          pilgrims?: Pilgrim[];
          mappings?: FieldMapping[];
          mode?: AutofillMode;
          overwrite?: boolean;
          profile?: any;
          onlyRepairFailed?: boolean;
          targetFailedItems?: Array<{ pilgrimIndex?: number; field: string }>;
        };

        let pilgrims: Pilgrim[] = Array.isArray(payload?.pilgrims) ? payload.pilgrims : [];
        let profile: Profile | null = payload?.profile || null;

        if (pilgrims.length === 0 || !profile) {
          try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
              const stored = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
              const rawProfiles = (stored?.[STORAGE_KEYS.PROFILES] as Profile[]) || [];
              const profiles = Array.isArray(rawProfiles) ? rawProfiles.filter((p: any) => p != null && typeof p === 'object') : [];
              const activeProfile = profiles.find((p: any) => p?.isDefault) || profiles[0] || null;
              if (pilgrims.length === 0 && activeProfile && Array.isArray(activeProfile.pilgrims)) {
                pilgrims = activeProfile.pilgrims;
              }
              if (!profile && activeProfile) {
                profile = activeProfile;
              }
            }
          } catch {}
        }

        if (pilgrims.length === 0) {
          sendResponse({ success: false, error: 'Complete your pilgrim profile first.' });
          break;
        }

        const safeProfile: Profile = profile || {
          id: 'default',
          name: 'Default Profile',
          pilgrims,
          selectedPilgrims: {},
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const onProg = (prog: any) => {
          chrome.runtime.sendMessage({
            type: MessageType.AUTOFILL_PROGRESS,
            payload: prog,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        };

        // Run unified state-machine autofill pipeline with real-time progress
        const managerResult = payload?.onlyRepairFailed
          ? await repairFailedFields({
              pilgrims,
              profile: safeProfile,
              doc: document,
              targetFailedItems: payload.targetFailedItems,
              serviceId: (payload as any).serviceId || recognition.serviceId,
              workflow: (payload as any).workflow,
              onProgress: onProg,
            })
          : await executeAutofill({
              pilgrims,
              profile: safeProfile,
              doc: document,
              url: window.location.href,
              serviceId: (payload as any).serviceId || recognition.serviceId,
              workflow: (payload as any).workflow,
              onProgress: onProg,
            });

        if (managerResult.step === 'pilgrim') {
          const fillResults: any[] = [];
          const pilgrimReports: any[] = [];

          for (const pp of managerResult.pilgrimResults) {
            const fieldsObj: Record<string, any> = {};
            for (const r of pp.results) {
              const fieldLabel = r.field === 'name' ? 'Name'
                : r.field === 'age' ? 'Age'
                : r.field === 'gender' ? 'Gender'
                : r.field === 'photoIdProof' ? 'Photo ID Proof'
                : 'Photo ID Number';

              const isDetected = r.detected ?? (r.status === 'verified' || !r.error?.includes('could not be safely detected'));
              const realConfidence = r.confidence !== undefined ? (r.confidence / 100) : (r.status === 'verified' ? 0.95 : 0);
              const realStrategy = r.strategy || (r.status === 'verified' ? 'semantic' : 'none');

              fieldsObj[r.field] = {
                fieldType: r.field,
                label: fieldLabel,
                detected: isDetected,
                confidence: realConfidence,
                strategy: realStrategy,
                filled: r.filled ?? (r.status === 'verified'),
                validated: r.status === 'verified',
                maskedValue: r.maskedValue,
                error: r.error,
              };

              fillResults.push({
                field: {
                  fieldId: `p${pp.pilgrimIndex}_${r.field}`,
                  scannedField: {
                    element: `p${pp.pilgrimIndex}_${r.field}`,
                    type: r.field === 'gender' || r.field === 'photoIdProof' ? 'select' : 'text',
                    label: `Pilgrim ${pp.pilgrimIndex + 1}: ${fieldLabel}`,
                    groupIndex: pp.pilgrimIndex,
                  },
                  pilgrimKey: r.field,
                  confidence: realConfidence,
                  matchReason: realStrategy !== 'none' ? `TTD Semantic Match (${realStrategy})` : 'Unresolved',
                },
                oldValue: '',
                newValue: r.maskedValue || '',
                status: r.status === 'verified' ? 'filled' : 'failed',
                timestamp: new Date().toISOString(),
                isAngularValid: r.status === 'verified',
                error: r.error,
              });
            }

            const requiredKeys = ['name', 'age', 'gender', 'photoIdProof', 'photoIdNumber'];
            const all5Verified = requiredKeys.every(k => fieldsObj[k]?.validated === true);

            pilgrimReports.push({
              pilgrimIndex: pp.pilgrimIndex,
              pilgrimName: pp.pilgrimName,
              fields: fieldsObj,
              allDetected: requiredKeys.every(k => fieldsObj[k]?.detected === true),
              allFilled: all5Verified,
              allValidated: all5Verified,
              errors: pp.results.filter(r => r.error).map(r => r.error!),
            });
          }

          sendResponse({
            success: managerResult.success,
            data: fillResults,
            managerResult,
            pilgrimReports,
            error: managerResult.success ? undefined : (managerResult.errors.join('; ') || 'Some fields could not be verified'),
          });
          break;
        }

        if (managerResult.step === 'general') {
          const fillResults: any[] = [];
          for (const gr of managerResult.generalResults) {
            fillResults.push({
              field: {
                fieldId: `gen_${gr.field}`,
                scannedField: {
                  label: gr.field,
                  type: gr.field === 'state' || gr.field === 'country' ? 'select' : 'text',
                },
                pilgrimKey: gr.field,
                confidence: 1,
              },
              status: gr.status === 'verified' ? 'filled' : 'failed',
              newValue: gr.maskedValue || '',
              isAngularValid: gr.status === 'verified',
              error: gr.error,
            });
          }
          sendResponse({
            success: managerResult.success,
            data: fillResults,
            managerResult,
            error: managerResult.success ? undefined : (managerResult.errors.join('; ') || 'General details could not be verified'),
          });
          break;
        }

        if (managerResult.step === 'srivari_instructions') {
          sendResponse({
            success: managerResult.success,
            data: [],
            managerResult,
            actionRequired: managerResult.actionRequired,
            actionMessage: managerResult.actionMessage,
            instructionsState: managerResult.instructionsState,
            error: managerResult.success ? undefined : (managerResult.errors.join('; ') || 'Srivari Seva instructions review needed'),
          });
          break;
        }

        if (managerResult.step === 'srivari_enrollment') {
          const fillResults: any[] = [];
          for (const gr of managerResult.generalResults) {
            fillResults.push({
              field: {
                fieldId: `srivari_${gr.field}`,
                scannedField: {
                  label: gr.field,
                  type: gr.field === 'state' || gr.field === 'country' || gr.field === 'idProofType' || gr.field === 'gender' ? 'select' : 'text',
                },
                pilgrimKey: gr.field,
                confidence: gr.confidence ? (gr.confidence / 100) : 1,
              },
              status: gr.status === 'verified' ? 'filled' : (gr.status === 'skipped' ? 'skipped' : 'failed'),
              newValue: gr.maskedValue || '',
              isAngularValid: gr.status === 'verified',
              error: gr.error,
            });
          }
          sendResponse({
            success: managerResult.success,
            data: fillResults,
            managerResult,
            actionRequired: managerResult.actionRequired,
            actionMessage: managerResult.actionMessage,
            optionalFieldsSkipped: managerResult.optionalFieldsSkipped,
            optionalFieldsFilled: managerResult.optionalFieldsFilled,
            error: managerResult.success ? undefined : (managerResult.errors.join('; ') || 'Some required fields could not be verified'),
          });
          break;
        }

        if (managerResult.temporaryLock || managerResult.state === 'TTD_TEMPORARY_BOOKING_LOCK') {
          sendResponse({
            success: false,
            data: [],
            managerResult,
            temporaryLock: managerResult.temporaryLock,
            error: managerResult.temporaryLock?.message || managerResult.errors.join('; '),
          });
          break;
        }

        // When managerResult encounters an unhandled step, queue, payment, or ambiguous DOM
        sendResponse({
          success: false,
          data: [],
          managerResult,
          error: managerResult.errors.join('; ') || 'Form fields could not be safely identified.',
        });
        break;
      }

      case MessageType.STOP_AUTOFILL: {
        requestStop();
        bookingGuardian.emergencyStop('User stopped autofill');
        sendResponse({ success: true });
        break;
      }

      case MessageType.EMERGENCY_STOP: {
        const reason = (message.payload as any)?.reason || 'User emergency stop';
        bookingGuardian.emergencyStop(reason);
        sendResponse({ success: true });
        break;
      }

      case MessageType.GET_GUARDIAN_STATE: {
        const payload = (message.payload || {}) as any;
        const evaluation = bookingGuardian.evaluateState({
          doc: document,
          url: window.location.href,
          profile: payload?.profile,
          selectedPilgrims: payload?.selectedPilgrims,
          explicitServiceId: payload?.serviceId || recognition.serviceId,
        });
        sendResponse({ success: true, data: evaluation });
        break;
      }

      case MessageType.HIGHLIGHT_FIELDS: {
        const mappings = (message?.payload as { mappings?: FieldMapping[] })?.mappings || [];
        FieldHighlighter.highlight(mappings, document);
        sendResponse({ success: true });
        break;
      }

      case MessageType.CLEAR_HIGHLIGHTS: {
        FieldHighlighter.clear(document);
        sendResponse({ success: true });
        break;
      }

      case MessageType.GET_PAGE_STATE: {
        sendResponse({ success: true, data: getPageState() });
        break;
      }

      case MessageType.VERIFY_FORM: {
        const { mappings } = (message.payload || {}) as { mappings?: FieldMapping[] };
        const summary = await AngularFormObserver.verifyForm(mappings || [], document);
        sendResponse({ success: true, data: summary });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    logger.error('Message handling error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function generateFingerprint(fields: Array<{ name?: string; id?: string; type: string }>): string {
  const sig = fields.map(f => `${f.name || f.id || 'unknown'}:${f.type}`).join('|');
  let hash = 0;
  for (let i = 0; i < sig.length; i++) {
    const char = sig.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `TTD-${Math.abs(hash).toString(16)}`;
}
