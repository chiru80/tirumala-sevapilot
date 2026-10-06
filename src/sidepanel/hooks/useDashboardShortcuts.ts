import { useEffect } from 'react';

interface UseDashboardShortcutsProps {
  onToggleCommandCenter: () => void;
  onTriggerFill: () => void;
  canTriggerFill: boolean;
  onToggleDiagnostics?: () => void;
}

export function useDashboardShortcuts({
  onToggleCommandCenter,
  onTriggerFill,
  canTriggerFill,
  onToggleDiagnostics,
}: UseDashboardShortcutsProps): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K -> Command Center
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleCommandCenter();
      }

      // Ctrl/Cmd + Shift + D -> Diagnostics
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onToggleDiagnostics?.();
      }

      // Alt + Shift + F -> Safe Fill & Verify trigger
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (canTriggerFill) {
          onTriggerFill();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCommandCenter, onTriggerFill, canTriggerFill]);
}
