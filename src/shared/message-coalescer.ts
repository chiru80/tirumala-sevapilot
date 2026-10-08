// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Message Deduplication & Coalescing (Phase 12)
// Suppresses duplicate and rapid redundant events across extension contexts.
// Prevents UI re-render storms and unnecessary message channel load.
// ─────────────────────────────────────────────────────────────

import logger from './logger';

export interface CoalesceOptions {
  windowMs?: number;
  equalityComparator?: (prev: unknown, next: unknown) => boolean;
}

export class MessageCoalescer {
  private static instance: MessageCoalescer | null = null;
  private lastMessages: Map<string, { payload: unknown; timestamp: number }> = new Map();
  private suppressedCount = 0;
  private totalDispatched = 0;

  private constructor() {}

  public static getInstance(): MessageCoalescer {
    if (!this.instance) {
      this.instance = new MessageCoalescer();
    }
    return this.instance;
  }

  /**
   * Evaluates if a message should be dispatched or suppressed as a duplicate.
   * Returns true if message is unique and SHOULD be dispatched.
   * Returns false if message is an identical duplicate within window and should be suppressed.
   */
  public shouldDispatch(
    topic: string,
    payload: unknown,
    options: CoalesceOptions = {},
  ): boolean {
    const windowMs = options.windowMs ?? 150;
    const now = Date.now();
    const last = this.lastMessages.get(topic);

    if (last && now - last.timestamp < windowMs) {
      const isDuplicate = options.equalityComparator
        ? options.equalityComparator(last.payload, payload)
        : this.defaultComparator(last.payload, payload);

      if (isDuplicate) {
        this.suppressedCount++;
        logger.debug(`[MessageCoalescer] Suppressed duplicate message on topic "${topic}"`);
        return false;
      }
    }

    this.lastMessages.set(topic, { payload, timestamp: now });
    this.totalDispatched++;
    return true;
  }

  private defaultComparator(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  /**
   * Clears all recorded message history for a topic or completely.
   */
  public clear(topic?: string): void {
    if (topic) {
      this.lastMessages.delete(topic);
    } else {
      this.lastMessages.clear();
    }
  }

  /**
   * Metrics for message traffic optimization.
   */
  public getMetrics(): { totalDispatched: number; suppressedCount: number; suppressionRate: string } {
    const total = this.totalDispatched + this.suppressedCount;
    const rate = total > 0 ? ((this.suppressedCount / total) * 100).toFixed(1) + '%' : '0%';
    return {
      totalDispatched: this.totalDispatched,
      suppressedCount: this.suppressedCount,
      suppressionRate: rate,
    };
  }

  public resetMetrics(): void {
    this.suppressedCount = 0;
    this.totalDispatched = 0;
  }
}

export const messageCoalescer = MessageCoalescer.getInstance();
