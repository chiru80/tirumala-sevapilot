// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Developer Workflow Recorder (Phase 5)
// STRICT DEVELOPER DIAGNOSTICS ONLY.
// Zero-PII Guarantee: All field values are masked/redacted.
// Disabled by default in production.
// ─────────────────────────────────────────────────────────────

export interface RecordedFieldObservation {
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
  isReadOnly: boolean;
  selectorSnippet?: string;
  sampleMaskedValue?: string; // Always redacted (e.g. "[REDACTED]", "XXXX XXXX 9012")
}

export interface WorkflowObservation {
  timestamp: string;
  url: string;
  serviceId?: string;
  detectedStep: string;
  visibleHeading?: string;
  fields: RecordedFieldObservation[];
  domFingerprint: {
    formCount: number;
    inputCount: number;
    buttonCount: number;
    hasCaptcha: boolean;
    hasQueueIndicator: boolean;
  };
}

class WorkflowRecorder {
  private isEnabled: boolean = false;
  private observations: WorkflowObservation[] = [];
  private maxEntries: number = 50;

  /**
   * Activates recorder for diagnostic debugging sessions.
   * Remains disabled by default in production.
   */
  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public getStatus(): boolean {
    return this.isEnabled;
  }

  /**
   * Redacts sensitive user data to prevent any PII logging.
   */
  public sanitizeValue(name: string, value: string): string {
    if (!value || typeof value !== 'string') return '';

    const lower = name.toLowerCase();

    if (
      lower.includes('pass') ||
      lower.includes('otp') ||
      lower.includes('cvv') ||
      lower.includes('card') ||
      lower.includes('token')
    ) {
      return '[STRICTLY_STRIPPED]';
    }

    if (lower.includes('name')) {
      return '[REDACTED]';
    }

    if (lower.includes('id') || lower.includes('aadhaar') || lower.includes('passport')) {
      const clean = value.replace(/\s+/g, '');
      if (clean.length > 4) {
        return `XXXX XXXX ${clean.slice(-4)}`;
      }
      return 'XXXX';
    }

    if (lower.includes('mobile') || lower.includes('phone')) {
      return `XXXXXX${value.slice(-4)}`;
    }

    if (lower.includes('email')) {
      return 'u***@example.com';
    }

    return '[DATA_PRESENT]';
  }

  /**
   * Records a snapshot of a TTD workflow step.
   */
  public recordStep(observation: {
    url: string;
    serviceId?: string;
    detectedStep: string;
    visibleHeading?: string;
    fields: Array<{
      fieldName: string;
      fieldType: string;
      isRequired: boolean;
      isReadOnly: boolean;
      selectorSnippet?: string;
      valueToSanitize?: string;
    }>;
    hasCaptcha?: boolean;
    hasQueueIndicator?: boolean;
  }): void {
    if (!this.isEnabled) return;

    const sanitizedFields: RecordedFieldObservation[] = observation.fields.map(f => ({
      fieldName: f.fieldName,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      isReadOnly: f.isReadOnly,
      selectorSnippet: f.selectorSnippet,
      sampleMaskedValue: f.valueToSanitize ? this.sanitizeValue(f.fieldName, f.valueToSanitize) : undefined,
    }));

    const entry: WorkflowObservation = {
      timestamp: new Date().toISOString(),
      url: observation.url.split('?')[0], // Strip search query parameters
      serviceId: observation.serviceId,
      detectedStep: observation.detectedStep,
      visibleHeading: observation.visibleHeading,
      fields: sanitizedFields,
      domFingerprint: {
        formCount: typeof document !== 'undefined' ? document.forms.length : 0,
        inputCount: sanitizedFields.length,
        buttonCount: typeof document !== 'undefined' ? document.querySelectorAll('button').length : 0,
        hasCaptcha: Boolean(observation.hasCaptcha),
        hasQueueIndicator: Boolean(observation.hasQueueIndicator),
      },
    };

    this.observations.push(entry);
    if (this.observations.length > this.maxEntries) {
      this.observations.shift();
    }
  }

  /**
   * Exports recorded observations for developer analysis.
   */
  public exportRecords(): WorkflowObservation[] {
    return [...this.observations];
  }

  public clear(): void {
    this.observations = [];
  }
}

export const workflowRecorder = new WorkflowRecorder();
