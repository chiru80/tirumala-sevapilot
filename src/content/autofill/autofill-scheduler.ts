// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Autofill Scheduler (Phase 3)
// Lightweight requestAnimationFrame scheduler for coordinating
// DOM read/write cycles and Angular-render settling without timer storms.
// ─────────────────────────────────────────────────

export class AutofillScheduler {
  /**
   * Wait for next animation frame to allow DOM rendering to settle.
   */
  public static async nextFrame(): Promise<void> {
    return new Promise(resolve => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 16);
      }
    });
  }

  /**
   * Wait for two frames to ensure styles and layouts have recalculated.
   */
  public static async settleDom(): Promise<void> {
    await this.nextFrame();
    await this.nextFrame();
  }

  /**
   * Schedule a microtask yield to allow queued Promise jobs to run.
   */
  public static async yieldMicrotask(): Promise<void> {
    return new Promise(resolve => queueMicrotask(resolve));
  }
}
