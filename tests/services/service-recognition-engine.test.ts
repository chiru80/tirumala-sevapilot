// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ServiceRecognitionEngine } from '../../src/services/service-recognition-engine';
import { ServiceType } from '../../src/shared/types';

describe('ServiceRecognitionEngine Multi-Signal Detection', () => {
  it('should detect Special Entry Darshan from URL and heading signals', () => {
    document.body.innerHTML = `
      <h1>Special Entry Darshan (Sri PAT)</h1>
      <label>Photo ID Proof</label>
      <label>Photo Id Number</label>
    `;
    document.title = 'TTD Online Booking - Special Entry Darshan';

    const result = ServiceRecognitionEngine.recognize(
      'https://ttdevasthanams.ap.gov.in/sed/pilgrim-details',
      document,
    );

    expect(result.status).toBe('detected');
    expect(result.serviceType).toBe(ServiceType.DARSHAN);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(result.confidenceBand).toBe('High');
    expect(result.signals.some(s => s.matched && s.type === 'url')).toBe(true);
    expect(result.signals.some(s => s.matched && s.type === 'heading')).toBe(true);
  });

  it('should detect Accommodation booking accurately', () => {
    document.body.innerHTML = `
      <h2>Accommodation Booking</h2>
      <label>Check-in Date</label>
      <label>Room Type</label>
    `;
    document.title = 'Tirumala Cottage & Room Booking';

    const result = ServiceRecognitionEngine.recognize(
      'https://ttdevasthanams.ap.gov.in/accommodation/booking',
      document,
    );

    expect(result.status).toBe('detected');
    expect(result.serviceType).toBe(ServiceType.ACCOMMODATION);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
  });

  it('should detect Arjitha Seva Electronic Dip', () => {
    document.body.innerHTML = `
      <h3>Arjitha Seva Kalyanotsavam</h3>
      <label>Seva Name</label>
    `;
    document.title = 'TTD Arjitha Seva';

    const result = ServiceRecognitionEngine.recognize(
      'https://ttdevasthanams.ap.gov.in/arjithaseva',
      document,
    );

    expect(result.status).toBe('detected');
    expect(result.serviceType).toBe(ServiceType.ARJITHA_SEVA);
  });

  it('should mark completely unrelated website as not-detected with zero confidence', () => {
    document.body.innerHTML = '<div>Random blog content</div>';
    document.title = 'Personal Travel Blog';

    const result = ServiceRecognitionEngine.recognize(
      'https://example.com/blog',
      document,
    );

    expect(result.status).toBe('not-detected');
    expect(result.confidenceScore).toBe(0);
    expect(result.isOfficialDomain).toBe(false);
  });

  it('rejects spoofed domains containing official domain as a substring', () => {
    document.body.innerHTML = '<h1>Special Entry Darshan</h1>';
    const spoofedUrl = 'https://ttdevasthanams.ap.gov.in.phishing-portal.com/sed';

    const result = ServiceRecognitionEngine.recognize(spoofedUrl, document);
    expect(result.isOfficialDomain).toBe(false);
  });

  it('returns uncertain status when margin between competing services is under minimum margin', () => {
    // Both Darshan and Arjitha Seva headings in ambiguous DOM
    document.body.innerHTML = `
      <h1>Special Entry Darshan</h1>
      <h2>Arjitha Seva Electronic Dip</h2>
    `;
    document.title = 'TTD Booking';

    // Generic URL on official domain
    const result = ServiceRecognitionEngine.recognize(
      'https://ttdevasthanams.ap.gov.in/booking/home',
      document,
    );

    // Competing signals without dominant URL match should be uncertain
    expect(result.status).toBe('uncertain');
  });

  it('detects Sri Srinivasa Divyanugraha Homam from URL and heading signals', () => {
    document.body.innerHTML = `
      <h1>Sri Srinivasa Divyanugraha Homam</h1>
      <label>Gothram</label>
      <label>Email Address</label>
    `;
    document.title = 'TTD Online Booking - Sri Srinivasa Divyanugraha Homam';

    const result = ServiceRecognitionEngine.recognize(
      'https://ttdevasthanams.ap.gov.in/srinivasa-homam',
      document,
    );

    expect(result.status).toBe('detected');
    expect(result.serviceType).toBe(ServiceType.ARJITHA_SEVA);
    expect(result.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(result.confidenceBand).toBe('High');
  });

  it('detects Padmavathi Ammavari Supadham Entry ₹200 accurately', () => {
    document.body.innerHTML = `
      <h2>Sri Padmavathi Ammavari Supadham Entry ₹200</h2>
      <label>Devotee Name</label>
      <label>Photo ID Proof</label>
    `;
    document.title = 'TTD Online Booking - Padmavathi Ammavari Temple';

    const result = ServiceRecognitionEngine.recognize(
      'https://ttdevasthanams.ap.gov.in/padmavathi',
      document,
    );

    expect(result.status).toBe('detected');
    expect(result.serviceType).toBe(ServiceType.DARSHAN);
    expect(result.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
  });
});
