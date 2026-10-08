# Tirumala SevaPilot — Release Intelligence Architecture & Reference (Phase 7)

## 1. Overview & Objective
The Release Intelligence system enables SevaPilot to understand:
- What TTD service is relevant (`serviceId` isolation)
- When tickets or slots are expected to be released
- What release information is officially confirmed vs derived from recurring patterns
- When the next release is approaching and when data has become stale
- What actionable preparation steps the user should perform next

**Core Safety Principle:**
> SevaPilot NEVER fabricates release dates, times, official press releases, or false confidence scores.
> `CONFIRMED > EXPECTED > ESTIMATED > UNKNOWN`
> `Fresh data > Stale data`
> `Official source > Third-party source`
> `Safe uncertainty > Fabricated certainty`

---

## 2. Pipeline Architecture
```
OFFICIAL SOURCE (Domain Validation)
            ↓
       FETCH PIPELINE
            ↓
  DEFENSIVE PARSER (release-date-parser & release-announcement-parser)
            ↓
   INTEGRITY VALIDATOR (validateReleaseScheduleIntegrity)
            ↓
   NORMALIZED EVENT (ReleaseEvent model, Asia/Kolkata IST)
            ↓
  CHANGE DETECTOR (detectReleaseChanges: flags isUpdated & previous dates)
            ↓
  BOUNDED CACHE (ttd-cache with TTL & schemaVersion)
            ↓
  RECURRING RECONCILER (Official Confirmed > Expected)
            ↓
    UI CONSUMERS (ReleaseTicker, ReleaseCountdownCard, UpcomingReleasesCard)
```

Each stage is strictly isolated:
- No scraping or date heuristics inside UI components.
- No browser locale guessing (`new Date(untrustedString)` strictly forbidden for announcement text).
- Complete decoupling from autofill hot path: release fetch failures never impact autofill or form detection.

---

## 3. Official Source Priority & Whitelist
Only official TTD domains qualify as authoritative sources:
1. `news.tirumala.org` (Official TTD News & Press Releases)
2. `tirumala.org` (TTD Official Portal)
3. `ttdevasthanams.ap.gov.in` (Official Booking Engine)

Third-party blogs, news aggregators, and unverified social media links are strictly rejected with `UNVERIFIED` and never marked as official.

---

## 4. Canonical Release Event Model
The normalized shape defined in `src/services/ttd-information/release-types.ts`:

```typescript
export interface ReleaseEvent {
  id: string;
  serviceId: string;
  serviceName?: string;
  displayName?: string;
  bookingType?: string;
  bookingDates?: string;
  targetBookingDates?: string;
  targetMonth?: string;

  /** Release date in YYYY-MM-DD (Asia/Kolkata). Undefined if not confirmed/expected */
  releaseDate?: string;

  /** Release time in HH:mm 24-hr format (Asia/Kolkata). Undefined if not announced */
  releaseTime?: string;

  timezone: 'Asia/Kolkata';

  status?: ReleaseStatus;       // 'CONFIRMED' | 'EXPECTED' | 'ESTIMATED' | 'UNKNOWN' | 'STALE' | 'EXPIRED'
  confidence?: ReleaseConfidence; // 'OFFICIAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

  source?: string;
  sourceUrl: string;
  sourceDate?: string;

  publishedAt?: string;
  publishedTimestamp?: string;
  fetchedAt?: string;
  expiresAt?: string;

  releasePattern?: string;
  advanceMonths?: number;
  releaseType?: string;

  verified: boolean;
  verificationStatus?: VerificationStatus;
  isConfirmed?: boolean;

  /** Change detection metadata */
  isUpdated?: boolean;
  previousReleaseDate?: string;
  previousReleaseTime?: string;
  changeNotes?: string;
  notes?: string;
}
```

---

## 5. Release Status & Confidence Definitions

### Status
- **`CONFIRMED`**: Officially confirmed by TTD press release or portal update for this exact event.
- **`EXPECTED`**: Derived from an established recurring pattern (e.g., 24th of the month for Special Entry ₹300), but not yet announced for this specific date.
- **`ESTIMATED`**: Weaker inference with limited historical data.
- **`UNKNOWN`**: Insufficient or ambiguous information.
- **`STALE`**: Previously known information whose freshness window has expired.
- **`EXPIRED`**: Release time or booking window has elapsed.

### Confidence
- **`OFFICIAL`**: Directly confirmed by whitelisted official TTD source.
- **`HIGH`**: Strong official recurring pattern.
- **`MEDIUM`**: Limited historical evidence.
- **`LOW`**: Weak inference.
- **`UNKNOWN`**: Insufficient evidence.

---

## 6. Strict Parsing & Timezone Normalization
- **Strict Date Parsing (`release-date-parser.ts`)**:
  - Validates month lengths (rejects April 31, February 30, October 32).
  - Handles leap years for February 29.
  - Supports English formats (`DD-MM-YYYY`, `DD/MM/YYYY`, `DD Month YYYY`, `Month DD, YYYY`, `DDth Month`).
  - Supports Telugu calendar dates (`అక్టోబర్ 24, 2026`).
  - Iterates over regex matches to avoid false matches on non-month words like "2 months".
- **Strict Time Parsing**:
  - Normalizes 12-hr and 24-hr expressions (`10 AM`, `10:00 AM IST`, `15:00 hrs`, `3 PM`) to `HH:mm`.
  - Rejects impossible times (`25:00`, `13:00 PM`).
- **Asia/Kolkata (IST)**:
  - Canonical epoch math computes `Date.UTC(...) - 5.5 * 3600 * 1000`.
  - Never relies on client machine local timezone for countdown or schedule comparisons.

---

## 7. Recurring Pattern Engine & Priority Rules
When no confirmed announcement exists for a service, `calculateExpectedRelease` derives an expected release:
- **Special Entry Darshan ₹300**: 24th of current month, 10:00 AM IST.
- **Padmavathi / Sri PAT ₹200**: 25th of current month, 10:00 AM IST.
- **Sri Srinivasa Divyanugraha Homam ₹1600**: 27th of current month, 15:00 IST.
- **Srivari Seva**: Irregular voluntary enrollment batches (no fixed monthly quota day; defaults to `UNKNOWN`).

**Reconciliation Rule (`reconcileReleaseEvents`):**
Official confirmed announcements **always override** expected pattern dates immediately.

---

## 8. Change Detection & Postponement Alerts
When an incoming official announcement updates an existing release:
- Compares `releaseDate`, `releaseTime`, and `targetBookingDates`.
- Flags `isUpdated: true`.
- Preserves `previousReleaseDate` and `previousReleaseTime`.
- Generates human-readable change notes (e.g. `Release date rescheduled from 2026-10-07 to 2026-10-08.`).
- UI surfaces `RELEASE UPDATED` badge and warns the user of the reschedule.

---

## 9. Cache, Freshness & Offline Grace
Implemented in `src/services/ttd-information/ttd-cache.ts`:
- **Storage**: `chrome.storage.local` with in-memory fallback.
- **Schema Version**: `schemaVersion: 1` with corruption protection.
- **Bounded Storage**: FIFO memory eviction capping entries at 50 to prevent unbounded memory growth.
- **Staleness Evaluation**: Automatically flags entries `STALE` when `Date.now() > expiresAt`.
- **Offline Fallback**: If offline or network fetch fails, cached data is served with staleness annotations, and autofill remains 100% operational.

---

## 10. Request Control & Fetch Coordination
Implemented in `src/services/ttd-information/ttd-fetch-coordinator.ts`:
- **Request Coalescing**: Multiple concurrent fetch requests for the same source/key share the in-flight Promise to eliminate duplicate network requests across popup and sidepanel.
- **Bounded Cooldown**: Minimum 5-minute interval between network fetches to eliminate aggressive polling.
- **Cache-First Lookups**: Reads fresh cached entries directly to prevent unnecessary network traffic.
- **Network Resilience**: Seamless fallback to cached data if network encounters connectivity issues.

---

## 11. Notification State Transitions
Implemented in `src/services/ttd-information/release-state-notifier.ts`:
- **State Lifecycle Transitions**:
  - `RELEASE_UPCOMING`: Future verified release.
  - `RELEASE_TODAY`: Release scheduled for current calendar day in Asia/Kolkata (IST).
  - `RELEASE_UPDATED`: Schedule changed/rescheduled by TTD.
  - `RELEASE_STARTED`: Release time reached (active window).
  - `RELEASE_PASSED`: Booking release window elapsed (> 2 hours).
- **Deduplicated Polling**: Remembers previous transition state for each event ID and suppresses duplicate alerts during background checks.

---

## 12. UI & Accessibility Integration
- **Release Ticker (`ReleaseTicker.tsx`)**:
  - Concise tags: `CONFIRMED`, `EXPECTED`, `RELEASE UPDATED`, `STALE`.
  - Free from internal jargon (no mention of "regex", "TTL", or "epoch").
  - Accessible marquee pause on hover/focus.
- **Countdown Card (`ReleaseCountdownCard.tsx`)**:
  - Precise countdown for `CONFIRMED` events.
  - Approximate guidance for `EXPECTED` events (`EXPECTED IN ~X DAYS`), avoiding false second-by-second precision.
  - Release Day Preparation mode when a release is today or approaching.
- **Internationalization (i18n)**:
  - 100% string coverage across English (`en`) and Telugu (`te`).

---

## 13. Security & Zero PII Guarantee
- Release intelligence processing and cache handle only public TTD quotas.
- Zero pilgrim details (Aadhaar, IDs, phone, addresses, names, photos) are ever passed to release parsers, caches, or diagnostics logs.

---

## 14. Known Limitations & Phase 8 Hand-Off
- Live dynamic portal scraping is intentionally blocked against active government login/queue endpoints to ensure strict compliance with anti-bot policies.
- Phase 8 (Booking Guardian) will introduce runtime DOM mutation observers and anomaly detection on the live booking page without bypassing queues.
