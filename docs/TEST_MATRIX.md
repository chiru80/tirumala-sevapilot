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

| Service | 1 | 2 | 3 | 4 | 5 | 6 | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| ₹300 Special Entry Darshan | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | General Details expected (1–6 valid) |
| ₹200 Padmavathi / Sri PAT | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | No General Details step (1–6 valid) |
| ₹1600 Divyanugraha Homam | ☒ | ☑ | N/A | N/A | N/A | N/A | Exact 2 required + Gothram mandatory |
| Srivari Seva | ☑ | N/A | N/A | N/A | N/A | N/A | Dedicated enrollment (exact 1 slot) |

## Workflow tests

- [ ] Digital queue detection
- [ ] Availability detection
- [ ] Slot selection detection
- [ ] Additional Services detection
- [ ] Pilgrim Details detection
- [ ] General Details detection after Pilgrim Details
- [ ] Review detection
- [ ] Payment detection without automation
- [ ] Srivari instructions detection
- [ ] Srivari enrollment detection
- [ ] Ambiguous workflow returns UNKNOWN/uncertain

## Autofill tests

- [ ] Name
- [ ] Age
- [ ] Gender
- [ ] ID proof type
- [ ] ID number
- [ ] General email
- [ ] City
- [ ] State
- [ ] Country
- [ ] PIN
- [ ] Gothram
- [ ] Srivari DOB
- [ ] Srivari address
- [ ] Angular rerender
- [ ] already-correct field is skipped safely
- [ ] failed verification is repaired
- [ ] disabled/read-only fields are not forced

## Safety tests

- [ ] No CAPTCHA automation
- [ ] No OTP automation
- [ ] No payment automation
- [ ] No final submission automation
- [ ] No queue manipulation
- [ ] No TTD temporary-lock bypass
- [ ] No declaration auto-tick
- [ ] No fitness-attestation auto-tick
- [ ] No sensitive PII in logs

## Temporary-lock tests

- [ ] Lock message detected
- [ ] Autofill stops
- [ ] No automatic retry
- [ ] No automatic refresh
- [ ] User can check booking history
- [ ] User can retry manually
- [ ] Lock remains dedicated if still present

## Release-data tests

- [ ] Official domain accepted
- [ ] non-official domain rejected
- [ ] stale event rejected/hidden
- [ ] expired event rejected/hidden
- [ ] unconfirmed event has no countdown
- [ ] exact confirmed event shows release time in IST
- [ ] future event selection works
- [ ] past events do not appear as upcoming

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
