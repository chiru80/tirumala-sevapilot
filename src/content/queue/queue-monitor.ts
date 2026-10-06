// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Passive Digital Queue Monitor
// Safe, passive observation of TTD virtual queues
// Strictly non-interfering: NO bypass, NO spam, NO reloads
// ─────────────────────────────────────────────────────────────

import { detectDigitalQueue } from '../../services/workflows/step-detectors';
import logger from '@shared/logger';

export type QueueState = 'IDLE' | 'QUEUE_DETECTED' | 'WAITING' | 'BOOKING_READY';

export interface QueueStatusReport {
  state: QueueState;
  message: string;
  isQueueActive: boolean;
  detectedAt?: number;
}

export type QueueListener = (status: QueueStatusReport) => void;

export class DigitalQueueMonitor {
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private currentState: QueueState = 'IDLE';
  private listeners = new Set<QueueListener>();
  private detectedAt?: number;

  constructor(private doc: Document = document) {}

  /**
   * Start passive observation of the DOM for digital queue transitions.
   */
  public start(): void {
    if (this.observer || this.pollTimer) {
      return; // Already running
    }

    // Initial check
    this.evaluate();

    // 1. MutationObserver to observe DOM changes without busy-polling
    this.observer = new MutationObserver(() => {
      this.evaluate();
    });

    if (this.doc.body) {
      this.observer.observe(this.doc.body, {
        childList: true,
        subtree: true,
      });
    }

    // 2. Controlled low-frequency safety check (every 3 seconds)
    this.pollTimer = setInterval(() => {
      this.evaluate();
    }, 3000);
  }

  /**
   * Stop monitoring and clean up all observers and timers.
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.currentState = 'IDLE';
  }

  /**
   * Subscribe to queue status changes.
   */
  public onStatusChange(listener: QueueListener): () => void {
    this.listeners.add(listener);
    // Send current status immediately
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the current queue status report.
   */
  public getStatus(): QueueStatusReport {
    switch (this.currentState) {
      case 'QUEUE_DETECTED':
      case 'WAITING':
        return {
          state: this.currentState,
          message: 'Queue detected. Please wait passively without refreshing.',
          isQueueActive: true,
          detectedAt: this.detectedAt,
        };
      case 'BOOKING_READY':
        return {
          state: 'BOOKING_READY',
          message: 'Booking page ready.',
          isQueueActive: false,
        };
      default:
        return {
          state: 'IDLE',
          message: 'No queue detected.',
          isQueueActive: false,
        };
    }
  }

  private evaluate(): void {
    const url = window.location?.href || '';
    const { isCurrentStep } = detectDigitalQueue(this.doc, url);

    if (isCurrentStep) {
      if (this.currentState !== 'QUEUE_DETECTED' && this.currentState !== 'WAITING') {
        this.currentState = 'QUEUE_DETECTED';
        this.detectedAt = Date.now();
        logger.info('TTD digital queue detected. Passively awaiting legitimate page transition.');
        this.notify();
      }
    } else if (this.currentState === 'QUEUE_DETECTED' || this.currentState === 'WAITING') {
      // Transition from queue to booking page
      this.currentState = 'BOOKING_READY';
      logger.info('TTD digital queue cleared. Legitimate booking page ready.');
      this.notify();
    }
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach(fn => {
      try {
        fn(status);
      } catch (err) {
        logger.debug('Queue listener error:', err);
      }
    });
  }
}

let globalQueueMonitor: DigitalQueueMonitor | null = null;

export function getGlobalQueueMonitor(doc: Document = document): DigitalQueueMonitor {
  if (!globalQueueMonitor) {
    globalQueueMonitor = new DigitalQueueMonitor(doc);
  }
  return globalQueueMonitor;
}
