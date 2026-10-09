# Browser & Platform Compatibility Matrix

## 1. Extension Runtime Environment Support

Tirumala SevaPilot operates as a Chrome Extension Manifest V3 application utilizing modern Web Platform and Chrome Extensions APIs.

| Browser / Environment | Version Baseline | Manifest V3 Status | Side Panel API | Service Worker API | Verified in E2E Lab |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Chrome / Chromium** | 120+ (Target: 131+) | Fully Supported | Supported (`chrome.sidePanel`) | Supported | ✅ Yes (Automated E2E Suite) |
| **Microsoft Edge** | 120+ | Fully Supported | Supported (`chrome.sidePanel`) | Supported | ✅ Yes (Chromium Engine Parity) |
| **Brave Browser** | 1.60+ | Fully Supported | Supported | Supported | ✅ Yes (Shields Tested) |
| **Opera / Opera GX** | 106+ | Fully Supported | Supported | Supported | ✅ Yes |
| **Firefox** | Not Supported | MV2/MV3 divergence | Alternative required | Event Pages | ❌ Out of Scope (Chrome-first) |
| **Safari** | Not Supported | WebExtension | N/A | Background Page | ❌ Out of Scope |

---

## 2. API Surface Verification

| Chrome Extension API | Minimum Chrome Version | SevaPilot Component | Fallback Strategy |
| :--- | :--- | :--- | :--- |
| `chrome.sidePanel.open` | Chrome 116 | Primary Cockpit (`src/sidepanel`) | Popup launcher (`popup.html`) |
| `chrome.storage.local` | Chrome 88 | Vault, Profiles, Settings Repository | In-memory cache fallback |
| `chrome.scripting.executeScript` | Chrome 88 | Autofill Runner, Mutation Injector | Content script static declarative registration |
| `chrome.tabs.onUpdated` | Chrome 88 | Service Worker Detection Sync | Polling on navigation |
| `chrome.runtime.sendMessage` | Chrome 88 | Cross-context command bus | Retries with exponential backoff |

---

## 3. DOM & Form Compatibility Verification

Tested across canonical TTD form permutations:
- **Angular Reactive Forms (`ng-untouched`, `formControlName`)**: Full synthetic dispatch of `input`, `change`, and `blur` events preserves Angular control validity.
- **Dynamic DOM Mutation**: Validated in `dynamic-dom.html` with full element replacement handling via MutationObserver.
- **Read-Only / Disabled Elements**: Auto-skipped with invariant preservation.
