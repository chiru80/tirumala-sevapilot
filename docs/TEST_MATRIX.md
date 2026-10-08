# Tirumala SevaPilot — Phase 0 Test Matrix

## Automated baseline

Required commands:
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`

Result in Phase 0:
- Not executed by repository connector.
- Must not be represented as passed.

## Service matrix

Automated suite: [`tests/services/service-matrix.test.ts`](file:///tests/services/service-matrix.test.ts) (54/54 tests passing)
Phase 6 Hardening suite: [`tests/services/srivari-seva-hardening.test.ts`](file:///tests/services/srivari-seva-hardening.test.ts) (27/27 tests passing)

| Service | 1 | 2 | 3 | 4 | 5 | 6 | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| ₹300 Special Entry Darshan | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | General Details expected (1–6 valid) |
| ₹200 Padmavathi / Sri PAT | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | No General Details step (1–6 valid) |
| ₹1600 Divyanugraha Homam | ☒ | ☑ | N/A | N/A | N/A | N/A | Exact 2 required + Gothram mandatory |
| Srivari Seva | ☑ | ☒ | ☒ | ☒ | ☒ | ☒ | Dedicated enrollment (strictly 1 slot) |

## Workflow tests

- [x] Digital queue detection
- [x] Availability detection
- [x] Slot selection detection
- [x] Additional Services detection
- [x] Pilgrim Details detection
- [x] General Details detection after Pilgrim Details
- [x] Review detection
- [x] Payment detection without automation
- [x] Srivari instructions detection
- [x] Srivari enrollment detection
- [x] Ambiguous workflow returns UNKNOWN/uncertain

## Autofill tests

- [x] Name
- [x] Age
- [x] Gender (no default Male)
- [x] ID proof type (no default Aadhaar)
- [x] ID number
- [x] General email
- [x] City
- [x] State
- [x] Country (no default India)
- [x] PIN
- [x] Gothram
- [x] Srivari DOB & Age consistency
- [x] Srivari address (doorNumber, street, district, etc.)
- [x] Angular rerender
- [x] already-correct field is skipped safely
- [x] failed verification is repaired
- [x] disabled/read-only fields are not forced

## Safety tests

- [x] No CAPTCHA automation
- [x] No OTP automation
- [x] No payment automation
- [x] No final submission automation
- [x] No queue manipulation
- [x] No TTD temporary-lock bypass
- [x] No declaration auto-tick
- [x] No fitness-attestation auto-tick
- [x] No sensitive PII in logs (Zero-PII guarantee)

## Temporary-lock tests

- [ ] Lock message detected
- [ ] Autofill stops
- [ ] No automatic retry
- [ ] No automatic refresh
- [ ] User can check booking history
- [ ] User can retry manually
- [ ] Lock remains dedicated if still present

## Release-data tests (Phase 7 Complete)

- [x] Official domain accepted (`news.tirumala.org`, `tirumala.org`, `ttdevasthanams.ap.gov.in`)
- [x] non-official domain rejected
- [x] stale event marked STALE and triggers refresh guidance
- [x] expired event filtered from upcoming verified releases
- [x] unconfirmed event has no countdown
- [x] exact confirmed event shows release time in IST
- [x] future event selection works and selects nearest release
- [x] past events do not appear as upcoming
- [x] strict date parsing rejects invalid calendar dates (Feb 30, Oct 32)
- [x] strict time parsing normalizes 12/24hr formats and rejects invalid times
- [x] recurring pattern engine produces EXPECTED status
- [x] official confirmed data wins over expected pattern data
- [x] change detection identifies rescheduled date/time and preserves previous dates
- [x] zero PII leakage into release logs or cache
- [x] i18n English and Telugu verified across release intelligence

## UI tests

- [ ] first-time Home
- [ ] existing-profile Home
- [ ] TTD-detected Home
- [ ] temporary-lock Home
- [ ] diagnostics hidden from primary Home
- [ ] diagnostics available in Settings
- [ ] one dominant CTA
- [ ] mobile/side-panel responsive
- [ ] keyboard accessibility
