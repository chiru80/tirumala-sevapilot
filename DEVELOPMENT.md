# Development Guide — Tirumala SevaPilot

This guide explains the architectural conventions, file organization, build pipeline, and developer workflows for Tirumala SevaPilot.

---

## 🛠 Tech Stack

- **Platform**: Chrome Manifest V3
- **Language**: TypeScript 7.0+ (strict mode)
- **UI Framework**: React 18 + React DOM
- **Bundler**: Vite 8 + `@crxjs/vite-plugin`
- **Styling**: Tailwind CSS 3.4 with custom SevaPilot theme tokens
- **Testing**: Vitest 5 + JSDOM for DOM unit tests
- **Security**: Web Crypto API (`crypto.subtle` with PBKDF2 and AES-GCM-256)

---

## 📂 Project Architecture

```
TIRUMALA SEVAPILOT/
├── dist/                  # Built extension output ready for chrome://extensions
├── icons/                 # Extension icons (16px, 48px, 128px)
├── src/
│   ├── background/        # Service worker, message router, alarms
│   ├── content/           # Content script, DOM scanners, field mappers, autofill engine
│   ├── i18n/              # English & Telugu translation catalogs and provider
│   ├── security/          # Web Crypto AES-GCM, Vault manager, SPBK backup system
│   ├── services/          # TTD service adapters (Darshan, Seva, Accommodation, etc.)
│   ├── shared/            # Enums, types, constants, logger, utils
│   ├── sidepanel/         # React Side Panel App, pages, components
│   ├── storage/           # chrome.storage repository, schema migrations
│   └── validation/        # Aadhaar (Verhoeff), Mobile, Email, PIN, DOB, Duplicates
├── tests/                 # Unit & integration test suites
├── manifest.json          # Chrome Manifest V3 definition
├── vite.config.ts         # Vite bundler configuration
└── package.json           # Scripts and dependencies
```

---

## 💻 Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Starts Vite development server with HMR |
| `npm run build` | Builds production-ready Chrome Extension into `dist/` |
| `npm run typecheck` | Validates TypeScript types across the entire project |
| `npm test` | Runs the full Vitest suite (all test files) |

---

## 🛡️ React Synthetic Event Handling in TTD

Because the official TTD portal (`ttdevasthanams.ap.gov.in`) is constructed using Next.js / React:
1. Setting `.value = "..."` directly on an HTMLInputElement does not notify React state.
2. We invoke `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)` to trigger internal state mutation.
3. We then dispatch `new Event('input', { bubbles: true })` and `new Event('change', { bubbles: true })`.
4. Finally, `blur` is fired to run any on-blur validation in TTD's forms.
