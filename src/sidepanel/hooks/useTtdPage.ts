import { useState, useEffect, useCallback } from 'react';
import { MessageType, ServiceType } from '@shared/types';
import type { ScanResult } from '@shared/types';

export type TtdPageStatus = 'LOADING' | 'TTD_DETECTED' | 'NOT_TTD' | 'UNSUPPORTED';

export interface CountdownState {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  isOpen: boolean;
}

export interface UseTtdPageResult {
  status: TtdPageStatus;
  pageDetected: boolean;
  serviceName: string;
  serviceType: ServiceType;
  isSupported: boolean;
  scanResult: ScanResult | null;
  isScanning: boolean;
  currentTime: string;
  countdown: CountdownState;
  scanPage: () => Promise<ScanResult | null>;
  openTtdWebsite: () => void;
  checkPageState: () => Promise<void>;
}

export function useTtdPage(): UseTtdPageResult {
  const [status, setStatus] = useState<TtdPageStatus>('LOADING');
  const [pageDetected, setPageDetected] = useState<boolean>(false);
  const [serviceName, setServiceName] = useState<string>('Special Entry Darshan (₹300)');
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.DARSHAN);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [countdown, setCountdown] = useState<CountdownState>({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
    isOpen: false,
  });

  const [currentTabId, setCurrentTabId] = useState<number | undefined>(undefined);

  const resolveAssociatedTab = useCallback(async (): Promise<chrome.tabs.Tab | null> => {
    if (!chrome.tabs) return null;
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    return tab || null;
  }, []);

  const checkPageState = useCallback(async () => {
    try {
      let isTtdTab = false;
      let targetTab: chrome.tabs.Tab | null = null;

      if (chrome.tabs) {
        targetTab = await resolveAssociatedTab();
        if (targetTab?.id) {
          setCurrentTabId(targetTab.id);
        }

        if (targetTab?.url && (targetTab.url.includes('ttdevasthanams.ap.gov.in') || targetTab.url.includes('tirupatibalaji.ap.gov.in'))) {
          isTtdTab = true;
          setPageDetected(true);
        }
      }

      if (!isTtdTab) {
        setPageDetected(false);
        setStatus('NOT_TTD');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_PAGE_STATE,
        targetTabId: targetTab?.id,
        payload: { targetTabId: targetTab?.id },
        timestamp: new Date().toISOString(),
      }).catch(() => null);

      if (response?.success && response.data) {
        setPageDetected(true);
        setIsSupported(response.data.isSupported !== false);
        if (response.data.serviceType) {
          setServiceType(response.data.serviceType as ServiceType);
        }
        if (response.data.lastScan) {
          setScanResult(response.data.lastScan);
        }
        if (response.data.isSupported === false) {
          setStatus('UNSUPPORTED');
        } else {
          setStatus('TTD_DETECTED');
        }
      } else if (isTtdTab) {
        setStatus('TTD_DETECTED');
      } else {
        setPageDetected(false);
        setStatus('NOT_TTD');
      }
    } catch {
      setStatus('NOT_TTD');
    }
  }, [resolveAssociatedTab]);

  const scanPage = useCallback(async (): Promise<ScanResult | null> => {
    setIsScanning(true);
    try {
      const targetTab = await resolveAssociatedTab();
      if (!targetTab?.id || !targetTab.url || (!targetTab.url.includes('ttdevasthanams.ap.gov.in') && !targetTab.url.includes('tirupatibalaji.ap.gov.in'))) {
        setStatus('NOT_TTD');
        return null;
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_SCAN,
        targetTabId: targetTab.id,
        payload: { targetTabId: targetTab.id },
        timestamp: new Date().toISOString(),
      });
      if (response?.success && response.data) {
        setScanResult(response.data);
        setPageDetected(true);
        setStatus('TTD_DETECTED');
        if (response.data.serviceType) {
          setServiceType(response.data.serviceType as ServiceType);
        }
        return response.data;
      }
      return null;
    } catch {
      return null;
    } finally {
      setIsScanning(false);
    }
  }, [resolveAssociatedTab]);

  const openTtdWebsite = useCallback(() => {
    if (pageDetected && chrome.tabs) {
      chrome.tabs.query({ url: ['https://ttdevasthanams.ap.gov.in/*', 'https://tirupatibalaji.ap.gov.in/*'] })
        .then(tabs => {
          if (tabs[0]?.id) chrome.tabs.update(tabs[0].id, { active: true });
        })
        .catch(() => {});
    } else if (chrome.tabs) {
      chrome.tabs.create({ url: 'https://ttdevasthanams.ap.gov.in' }).catch(() => {});
    } else {
      window.open('https://ttdevasthanams.ap.gov.in', '_blank');
    }
  }, [pageDetected]);

  useEffect(() => {
    checkPageState();

    // IST clock ticker
    const updateClock = () => {
      const now = new Date();
      const istTime = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentTime(istTime);

      // Countdown to next morning (9 AM) or afternoon (3 PM) booking window
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const istNow = new Date(utc + 3600000 * 5.5);

      const morning = new Date(istNow);
      morning.setHours(9, 0, 0, 0);

      const afternoon = new Date(istNow);
      afternoon.setHours(15, 0, 0, 0);

      let target: Date;
      if (istNow < morning) {
        target = morning;
      } else if (istNow < afternoon) {
        target = afternoon;
      } else {
        const tomorrowMorning = new Date(morning);
        tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
        target = tomorrowMorning;
      }

      const diff = target.getTime() - istNow.getTime();
      const openSinceMorning = istNow.getTime() - morning.getTime();
      const openSinceAfternoon = istNow.getTime() - afternoon.getTime();
      const isOpen = (openSinceMorning >= 0 && openSinceMorning < 120000) ||
                     (openSinceAfternoon >= 0 && openSinceAfternoon < 120000);

      if (isOpen) {
        setCountdown({ days: '00', hours: '00', minutes: '00', seconds: '00', isOpen: true });
      } else {
        const totalSec = Math.max(0, Math.floor(diff / 1000));
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        setCountdown({
          days: String(d).padStart(2, '0'),
          hours: String(h).padStart(2, '0'),
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0'),
          isOpen: false,
        });
      }
    };

    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    const pollInterval = setInterval(checkPageState, 2500);

    const onTabActivated = () => checkPageState();
    const onTabUpdated = (_tabId: number, changeInfo: { status?: string; url?: string }) => {
      if (changeInfo.status === 'complete' || changeInfo.url) {
        checkPageState();
      }
    };

    if (chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(onTabActivated);
    }
    if (chrome.tabs?.onUpdated) {
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }

    const messageListener = (message: { type: string; payload: any }) => {
      if (message.type === MessageType.PAGE_DETECTED) {
        setPageDetected(true);
        setStatus('TTD_DETECTED');
        if (message.payload?.name) setServiceName(message.payload.name);
        if (message.payload?.serviceType) setServiceType(message.payload.serviceType as ServiceType);
      }
    };
    chrome.runtime?.onMessage?.addListener(messageListener);

    return () => {
      clearInterval(clockInterval);
      clearInterval(pollInterval);
      if (chrome.tabs?.onActivated) {
        chrome.tabs.onActivated.removeListener(onTabActivated);
      }
      if (chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
      }
      chrome.runtime?.onMessage?.removeListener(messageListener);
    };
  }, [checkPageState]);

  return {
    status,
    pageDetected,
    serviceName,
    serviceType,
    isSupported,
    scanResult,
    isScanning,
    currentTime,
    countdown,
    scanPage,
    openTtdWebsite,
    checkPageState,
  };
}
