// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getAllAdapters, getAdapterForUrl } from '../../src/services/registry';
import { ServiceType } from '../../src/shared/types';

describe('Service Adapters Registry & URL Matching', () => {
  it('should register all 6 adapters', () => {
    const adapters = getAllAdapters();
    expect(adapters.length).toBe(6);
    expect(adapters.map(a => a.serviceType)).toContain(ServiceType.DARSHAN);
    expect(adapters.map(a => a.serviceType)).toContain(ServiceType.ARJITHA_SEVA);
    expect(adapters.map(a => a.serviceType)).toContain(ServiceType.ACCOMMODATION);
    expect(adapters.map(a => a.serviceType)).toContain(ServiceType.SRIVANI);
    expect(adapters.map(a => a.serviceType)).toContain(ServiceType.SRIVARI_SEVA);
    expect(adapters.map(a => a.serviceType)).toContain(ServiceType.GENERIC);
  });

  it('should detect Darshan page accurately', () => {
    const fakeDoc = document.implementation.createHTMLDocument();
    fakeDoc.body.innerHTML = '<h2>Special Entry Darshan (₹300) Booking</h2>';
    const adapter = getAdapterForUrl('https://ttdevasthanams.ap.gov.in/home/dashboard', fakeDoc);
    expect(adapter.serviceType).toBe(ServiceType.DARSHAN);
  });

  it('should fall back to Generic adapter for unknown TTD urls', () => {
    const fakeDoc = document.implementation.createHTMLDocument();
    const adapter = getAdapterForUrl('https://ttdevasthanams.ap.gov.in/unknown/page', fakeDoc);
    expect(adapter).toBeDefined();
    expect(adapter.serviceType).toBe(ServiceType.GENERIC);
  });
});
