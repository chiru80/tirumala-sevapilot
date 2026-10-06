import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleMessage } from '../../src/background/message-router';
import { MessageType } from '../../src/shared/types';

describe('P0 — Tab Binding Safety', () => {
  let tabsMap = new Map<number, any>();
  let activeTabId: number | null = null;
  let sentMessages: Array<{ tabId: number; message: any }> = [];

  beforeEach(() => {
    tabsMap.clear();
    sentMessages = [];
    activeTabId = null;

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: {
        query: vi.fn(async (queryInfo: any) => {
          if (queryInfo.active) {
            const tab = activeTabId ? tabsMap.get(activeTabId) : null;
            return tab ? [tab] : [];
          }
          if (queryInfo.url) {
            const list = Array.from(tabsMap.values());
            return list.filter(t => t.url && (t.url.includes('ttdevasthanams.ap.gov.in') || t.url.includes('tirupatibalaji.ap.gov.in')));
          }
          return Array.from(tabsMap.values());
        }),
        get: vi.fn(async (tabId: number) => {
          const tab = tabsMap.get(tabId);
          if (!tab) {
            throw new Error(`Tab ${tabId} not found`);
          }
          return tab;
        }),
        sendMessage: vi.fn(async (tabId: number, message: any) => {
          sentMessages.push({ tabId, message });
          return { success: true, data: { status: 'ok', tabId } };
        }),
      },
      runtime: {
        getManifest: () => ({ content_scripts: [] }),
        sendMessage: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
      },
    };
  });

  // Scenario 1: One TTD tab
  it('1. targets exact single TTD tab when active', async () => {
    const tab1 = { id: 101, url: 'https://ttdevasthanams.ap.gov.in/home/dashboard', active: true };
    tabsMap.set(101, tab1);
    activeTabId = 101;

    let response: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_SCAN,
        payload: { targetTabId: 101 },
      } as any,
      {} as any,
      (res) => { response = res; }
    );

    expect(response?.success).toBe(true);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].tabId).toBe(101);
  });

  // Scenario 2: Two TTD tabs
  it('2. sends fill command only to the explicitly targeted TTD tab when multiple TTD tabs are open', async () => {
    const tabA = { id: 201, url: 'https://ttdevasthanams.ap.gov.in/darshan', active: false };
    const tabB = { id: 202, url: 'https://tirupatibalaji.ap.gov.in/accommodation', active: true };
    tabsMap.set(201, tabA);
    tabsMap.set(202, tabB);
    activeTabId = 202;

    let response: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_FILL,
        targetTabId: 201,
        payload: {
          targetTabId: 201,
          pilgrims: [{ fullName: 'Devotee 1', age: 30, gender: 'Male', idType: 'Aadhaar Card', idNumber: '123456789012' }],
        },
      } as any,
      {} as any,
      (res) => { response = res; }
    );

    expect(response?.success).toBe(true);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].tabId).toBe(201); // Specifically Tab A, NOT Tab B
  });

  // Scenario 3: Active non-TTD tab
  it('3. rejects autofill and returns safe guidance when active tab is non-TTD and no valid target is supplied', async () => {
    const googleTab = { id: 301, url: 'https://www.google.com/search?q=tirupati', active: true };
    const ttdTab = { id: 302, url: 'https://ttdevasthanams.ap.gov.in/darshan', active: false };
    tabsMap.set(301, googleTab);
    tabsMap.set(302, ttdTab);
    activeTabId = 301;

    let response: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_FILL,
        // No explicit targetTabId -> checks active tab which is google.com
        payload: {},
      } as any,
      {} as any,
      (res) => { response = res; }
    );

    expect(response?.success).toBe(false);
    expect(response?.error).toBe('Please open a supported TTD booking page.');
    // Must NOT guess or fallback to tab 302
    expect(sentMessages.length).toBe(0);
  });

  // Scenario 4: Sidepanel attached to TTD Tab A while Tab B is also open
  it('4. respects sidepanel tab ownership attached to Tab A while Tab B is open and active', async () => {
    const tabA = { id: 401, url: 'https://ttdevasthanams.ap.gov.in/darshan', active: false };
    const tabB = { id: 402, url: 'https://ttdevasthanams.ap.gov.in/accommodation', active: true };
    tabsMap.set(401, tabA);
    tabsMap.set(402, tabB);
    activeTabId = 402;

    let response: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_SCAN,
        targetTabId: 401,
        payload: { targetTabId: 401 },
      } as any,
      {} as any,
      (res) => { response = res; }
    );

    expect(response?.success).toBe(true);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].tabId).toBe(401);
  });

  // Scenario 5: Closed target tab
  it('5. returns safe failure when the target tab was closed', async () => {
    // Tab 501 does not exist in tabsMap
    let response: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_SCAN,
        targetTabId: 501,
        payload: { targetTabId: 501 },
      } as any,
      {} as any,
      (res) => { response = res; }
    );

    expect(response?.success).toBe(false);
    expect(response?.error).toBe('Please open a supported TTD booking page.');
    expect(sentMessages.length).toBe(0);
  });

  // Scenario 6: Unsupported browser internal page
  it('6. rejects internal browser pages (chrome://, about:, etc.)', async () => {
    const chromeTab = { id: 601, url: 'chrome://extensions', active: true };
    tabsMap.set(601, chromeTab);
    activeTabId = 601;

    let response: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_SCAN,
        targetTabId: 601,
        payload: { targetTabId: 601 },
      } as any,
      {} as any,
      (res) => { response = res; }
    );

    expect(response?.success).toBe(false);
    expect(response?.error).toBe('Please open a supported TTD booking page.');
    expect(sentMessages.length).toBe(0);
  });
});
