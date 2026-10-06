import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  markNotificationRead,
  clearNotifications,
  getSessionHistory,
  clearSessionHistory,
} from '@storage/repository';
import type { NotificationItem, SessionHistoryItem } from '@shared/types';

export interface UseSessionHistoryResult {
  notifications: NotificationItem[];
  sessionHistory: SessionHistoryItem[];
  loadNotifications: () => Promise<void>;
  loadHistory: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  clearAllHistory: () => Promise<void>;
}

export function useSessionHistory(): UseSessionHistoryResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const list = await getNotifications();
      setNotifications(list);
    } catch {
      setNotifications([]);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const hist = await getSessionHistory();
      setSessionHistory(hist);
    } catch {
      setSessionHistory([]);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadHistory();
  }, [loadNotifications, loadHistory]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    await loadNotifications();
  }, [loadNotifications]);

  const clearAllNotifications = useCallback(async () => {
    await clearNotifications();
    await loadNotifications();
  }, [loadNotifications]);

  const clearAllHistory = useCallback(async () => {
    await clearSessionHistory();
    await loadHistory();
  }, [loadHistory]);

  return {
    notifications,
    sessionHistory,
    loadNotifications,
    loadHistory,
    markRead,
    clearAllNotifications,
    clearAllHistory,
  };
}
