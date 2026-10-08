// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Centralized Timer & Lifecycle Manager (Phase 12)
// Deterministic lifecycle ownership, bounds-checking, and leak prevention.
// Ensures zero orphan timers or unbounded intervals across MV3 lifecycle.
// ─────────────────────────────────────────────────────────────

import logger from './logger';

export interface ManagedTimer {
  id: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
  owner: string;
  purpose: string;
  type: 'timeout' | 'interval';
  createdAt: number;
  maxLifetimeMs: number;
}

export class TimerManager {
  private static instance: TimerManager | null = null;
  private timers: Map<number, ManagedTimer> = new Map();
  private nextTimerKey = 1;

  private constructor() {
    // Periodic sweep for safety bounds (every 30 seconds)
    if (typeof setInterval !== 'undefined') {
      const sweepId = setInterval(() => this.sweepStaleTimers(), 30000);
      if (typeof sweepId === 'object' && typeof (sweepId as any).unref === 'function') {
        (sweepId as any).unref();
      }
    }
  }

  public static getInstance(): TimerManager {
    if (!this.instance) {
      this.instance = new TimerManager();
    }
    return this.instance;
  }

  /**
   * Sets a managed timeout bounded by max lifetime.
   */
  public setTimeout(
    callback: () => void,
    delayMs: number,
    owner: string,
    purpose: string,
    maxLifetimeMs: number = Math.max(delayMs * 2, 60000),
  ): number {
    const key = this.nextTimerKey++;
    const timerId = setTimeout(() => {
      this.timers.delete(key);
      try {
        callback();
      } catch (err) {
        logger.error(`[TimerManager] Error in managed timeout for ${owner} (${purpose}):`, err);
      }
    }, delayMs);

    this.timers.set(key, {
      id: timerId,
      owner,
      purpose,
      type: 'timeout',
      createdAt: Date.now(),
      maxLifetimeMs,
    });

    return key;
  }

  /**
   * Sets a managed interval with a hard maximum lifetime to prevent orphan loops.
   */
  public setInterval(
    callback: () => void,
    intervalMs: number,
    owner: string,
    purpose: string,
    maxLifetimeMs: number = 300000, // 5 minute hard ceiling by default
  ): number {
    const key = this.nextTimerKey++;
    const timerId = setInterval(() => {
      const timer = this.timers.get(key);
      if (timer && Date.now() - timer.createdAt > timer.maxLifetimeMs) {
        logger.warn(`[TimerManager] Auto-terminating exceeded interval for ${owner} (${purpose})`);
        this.clearTimer(key);
        return;
      }
      try {
        callback();
      } catch (err) {
        logger.error(`[TimerManager] Error in managed interval for ${owner} (${purpose}):`, err);
      }
    }, intervalMs);

    this.timers.set(key, {
      id: timerId,
      owner,
      purpose,
      type: 'interval',
      createdAt: Date.now(),
      maxLifetimeMs,
    });

    return key;
  }

  /**
   * Clears a specific managed timer by its key.
   */
  public clearTimer(key: number): void {
    const timer = this.timers.get(key);
    if (!timer) return;

    if (timer.type === 'timeout') {
      clearTimeout(timer.id as ReturnType<typeof setTimeout>);
    } else {
      clearInterval(timer.id as ReturnType<typeof setInterval>);
    }

    this.timers.delete(key);
  }

  /**
   * Clears all timers registered by a specific owner (e.g. on unmount or session stop).
   */
  public clearAllForOwner(owner: string): number {
    let cleared = 0;
    for (const [key, timer] of Array.from(this.timers.entries())) {
      if (timer.owner === owner) {
        this.clearTimer(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Disposes all active timers across the system.
   */
  public disposeAll(): void {
    for (const key of Array.from(this.timers.keys())) {
      this.clearTimer(key);
    }
    this.timers.clear();
  }

  /**
   * Cleans up any timer that has exceeded its maximum allocated lifetime.
   */
  private sweepStaleTimers(): void {
    const now = Date.now();
    for (const [key, timer] of Array.from(this.timers.entries())) {
      if (now - timer.createdAt > timer.maxLifetimeMs) {
        logger.warn(`[TimerManager] Sweeping stale timer ${key} from ${timer.owner} (${timer.purpose})`);
        this.clearTimer(key);
      }
    }
  }

  /**
   * Active timer count for observability.
   */
  public getActiveTimerCount(): number {
    return this.timers.size;
  }
}

export const timerManager = TimerManager.getInstance();
