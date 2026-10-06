import { describe, it, expect, beforeEach } from 'vitest';

// Setup mock chrome.storage.local before importing repository
const storageMap = new Map<string, any>();
(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: string | string[]) => {
        if (typeof key === 'string') {
          return { [key]: storageMap.get(key) };
        }
        const res: Record<string, any> = {};
        for (const k of key) {
          res[k] = storageMap.get(k);
        }
        return res;
      },
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) {
          storageMap.set(k, v);
        }
      },
      remove: async (key: string) => {
        storageMap.delete(key);
      },
      clear: async () => {
        storageMap.clear();
      },
    },
  },
};

import {
  validateImportPayload,
  importProfilesSafely,
  getNotifications,
  addNotification,
  markNotificationRead,
  clearNotifications,
  getSessionHistory,
  recordSessionHistory,
  clearSessionHistory,
} from '../../src/storage/repository';
import { ServiceType } from '../../src/shared/types';

describe('Repository Phase 3 Features: Notifications, History & Safe Import', () => {
  beforeEach(async () => {
    await clearNotifications();
    await clearSessionHistory();
  });

  it('should store, read, and mark notifications as read', async () => {
    const notif = await addNotification({
      type: 'success',
      title: 'Autofill Done',
      message: 'All fields completed.',
    });

    expect(notif.read).toBe(false);

    let all = await getNotifications();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Autofill Done');

    await markNotificationRead(notif.id);
    all = await getNotifications();
    expect(all[0].read).toBe(true);

    await clearNotifications();
    all = await getNotifications();
    expect(all.length).toBe(0);
  });

  it('should record session history with zero PII', async () => {
    await recordSessionHistory({
      serviceType: ServiceType.DARSHAN,
      serviceName: 'Special Entry Darshan',
      pilgrimCount: 4,
      fieldsFilled: 20,
      fieldsTotal: 20,
      status: 'completed',
      durationMs: 340,
    });

    const history = await getSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].serviceName).toBe('Special Entry Darshan');
    expect(history[0].pilgrimCount).toBe(4);
    expect(history[0].fieldsFilled).toBe(20);

    // Verify zero PII
    expect((history[0] as any).name).toBeUndefined();
    expect((history[0] as any).idNumber).toBeUndefined();
    expect((history[0] as any).mobile).toBeUndefined();
  });

  it('should validate JSON import schema and reject invalid payloads', () => {
    const invalidPayload = { somethingElse: true };
    const res1 = validateImportPayload(invalidPayload);
    expect(res1.valid).toBe(false);

    const validPayload = {
      profiles: [
        {
          name: 'Family Squad',
          pilgrims: [
            {
              fullName: 'Chiru Deep',
              gender: 'Male',
              idType: 'Aadhaar',
              idNumber: '123456789012',
            },
          ],
        },
      ],
    };
    const res2 = validateImportPayload(validPayload);
    expect(res2.valid).toBe(true);
    expect(res2.summary?.profileCount).toBe(1);
    expect(res2.summary?.pilgrimCount).toBe(1);
  });

  it('should safely import profiles and create automatic backup copy', async () => {
    const importPayload = [
      {
        id: 'old-1',
        name: 'Friends Tirumala Seva',
        pilgrims: [
          {
            id: 'old-p1',
            fullName: 'Anusuri Chiru',
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '998877665544',
            mobile: '9876543210',
          },
        ],
        selectedPilgrims: {},
        isDefault: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const result = await importProfilesSafely(importPayload as any);
    expect(result.importedCount).toBe(1);
  });
});
