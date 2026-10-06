import { useState, useCallback } from 'react';

export interface UseDashboardDialogsResult {
  isPreFlightOpen: boolean;
  isCommandCenterOpen: boolean;
  isNotificationCenterOpen: boolean;
  isSessionHistoryOpen: boolean;
  showDiagnostics: boolean;
  openPreFlight: () => void;
  closePreFlight: () => void;
  openCommandCenter: () => void;
  closeCommandCenter: () => void;
  toggleCommandCenter: () => void;
  openNotificationCenter: () => void;
  closeNotificationCenter: () => void;
  openSessionHistory: () => void;
  closeSessionHistory: () => void;
  toggleDiagnostics: () => void;
}

export function useDashboardDialogs(): UseDashboardDialogsResult {
  const [isPreFlightOpen, setIsPreFlightOpen] = useState<boolean>(false);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState<boolean>(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);
  const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  const openPreFlight = useCallback(() => setIsPreFlightOpen(true), []);
  const closePreFlight = useCallback(() => setIsPreFlightOpen(false), []);

  const openCommandCenter = useCallback(() => setIsCommandCenterOpen(true), []);
  const closeCommandCenter = useCallback(() => setIsCommandCenterOpen(false), []);
  const toggleCommandCenter = useCallback(() => setIsCommandCenterOpen(prev => !prev), []);

  const openNotificationCenter = useCallback(() => setIsNotificationCenterOpen(true), []);
  const closeNotificationCenter = useCallback(() => setIsNotificationCenterOpen(false), []);

  const openSessionHistory = useCallback(() => setIsSessionHistoryOpen(true), []);
  const closeSessionHistory = useCallback(() => setIsSessionHistoryOpen(false), []);

  const toggleDiagnostics = useCallback(() => setShowDiagnostics(prev => !prev), []);

  return {
    isPreFlightOpen,
    isCommandCenterOpen,
    isNotificationCenterOpen,
    isSessionHistoryOpen,
    showDiagnostics,
    openPreFlight,
    closePreFlight,
    openCommandCenter,
    closeCommandCenter,
    toggleCommandCenter,
    openNotificationCenter,
    closeNotificationCenter,
    openSessionHistory,
    closeSessionHistory,
    toggleDiagnostics,
  };
}
