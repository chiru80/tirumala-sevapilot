# Browser E2E Test Architecture & Reliability Lab

## 1. Overview & Principles
The Browser E2E Test Architecture for **Tirumala SevaPilot** tests the real, production-built Manifest V3 Chrome Extension within a real Chromium browser environment. 

### Core Test Principles:
1. **Production-Built Extension Under Test**: Every test runs against `./dist` produced by `npm run build` (`vite build`), never against unbundled source code or JSDOM mocks.
2. **Deterministic Local Fixtures**: All tests run against locally intercepted TTD route fixtures (`https://ttdevasthanams.ap.gov.in/**`) served deterministically by Playwright route mocking. Zero live requests hit TTD production servers, zero quotas are consumed, and synthetic data is strictly used.
3. **Rigid Human Safety Boundaries**: Explicit negative assertions guarantee zero automated solving of CAPTCHA/OTP, zero automation of payment gateways/CVV, zero auto-checking of declarations, and zero logging of PII.
4. **Tab & Context Isolation**: Persistent browser contexts with isolated profile data directories prevent state contamination across test runs.

---

## 2. Infrastructure Setup & Tooling

```
               ┌───────────────────────────────────────────────┐
               │        Playwright Runner (Node.js 22/24)      │
               └───────────────────────┬───────────────────────┘
                                       │ Launches Persistent Context
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Chromium Headless / Headed Shell                      │
│                                                                             │
│  ┌───────────────────────┐  chrome.storage   ┌───────────────────────────┐  │
│  │   SevaPilot Extension │ ◄───────────────► │   chrome.storage.local    │  │
│  │   (dist/ MV3 bundle)  │                   └───────────────────────────┘  │
│  └───────────┬───────────┘                                                  │
│              │ Injects content scripts                                      │
│              ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Local TTD Fixture Page (Intercepted: https://ttdevasthanams.ap.gov.in) │  │
│  │ • special-entry-300.html   • homam-1600.html   • temporary-lock.html  │  │
│  │ • padmavathi-200.html      • srivari-seva.html • queue-simulation.html│  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration & Runner Details
- **Configuration File**: `playwright.config.ts`
- **Test Directory**: `./tests/e2e/`
- **Browser**: Chromium 131.0.6778.33
- **Test Isolation**: Sequential test execution (`workers: 1`, `fullyParallel: false`) to manage persistent extension user data directories safely.
- **Fixtures Directory**: `tests/e2e/fixtures/`
- **Helpers**: `tests/e2e/helpers/extension-fixture.ts`, `tests/e2e/helpers/mock-profiles.ts`

---

## 3. Test Suites & Coverage Matrix

| Suite File | Scope & Invariants Tested | Real Browser Interactions |
| :--- | :--- | :--- |
| `01-onboarding-and-navigation.spec.ts` | MV3 manifest validity, permissions, onboarding flow, breadcrumb navigation, Back button stack. | Chromium launch, sidepanel reload, keyboard/click navigation. |
| `02-service-readiness-correctness.spec.ts` | Canonical service rules: unknown services fail closed, Homam 2-devotee + Gothram rule, Srivari Seva 18-60 age boundary. | Service selector dialog interaction, readiness badge evaluation. |
| `03-autofill-pipeline-and-dom.spec.ts` | Field autofill, input event dispatch, preservation of devotee manual edits, dynamic DOM replacement recovery. | Tab navigation, DOM input filling, dynamic DOM mutation observer. |
| `04-safety-human-boundaries.spec.ts` | Invariant defense: zero CAPTCHA fill, zero OTP touch, zero declaration checking, zero payment clicking, zero console PII leaks. | Console listener inspection, disabled submit checking, DOM security scan. |
| `05-queue-and-temporary-lock.spec.ts` | Temporary booking lock recognition, BLOCKED state presentation, exclusion of retry/try-again buttons, queue progression, emergency stop. | Virtual queue fixture inspection, temporary lock DOM validation. |
| `06-tab-isolation-and-lifecycle.spec.ts` | Multi-tab context isolation, session independence, storage persistence across multiple sidepanel reloads. | Multi-tab context switching, MV3 storage roundtrips. |
| `07-accessibility-and-performance.spec.ts` | 5-language translation parity (EN, TE, HI, TA, KN), keyboard Tab focus navigation, storage & DOM latency benchmarks. | i18n JSON tree analysis, sidepanel focus execution, `performance.now()` benchmarking. |

---

## 4. Execution Commands

### Running Locally
```bash
# 1. Build the production Manifest V3 extension
npm run build

# 2. Run all Browser E2E tests
npm run test:e2e

# 3. Run in headed mode (for visual debugging)
npm run test:e2e:headed

# 4. View HTML report
npx playwright show-report
```

### Running Unit Tests (Vitest)
```bash
# Unit tests execute in complete isolation from E2E specs
npm test
```
