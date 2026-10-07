# Tirumala SevaPilot — Phase 0 Known Issues

## P0 — Correctness / architecture

### K01 — Release data freshness
The release calendar contains static verified-event data. Even with stale/expiry checks, static entries can age into misleading product content. The source → parser → normalized event → cache pipeline needs a strict freshness policy and future-event filtering.

### K02 — Srivari rule duplication
The canonical Srivari workflow says `maxPilgrims: 1` while the legacy Srivari adapter says `maxPilgrims: 10`. These are contradictory limits and must have one authoritative owner.

### K03 — Srivari field-rule duplication
The workflow defines detailed required/optional/user-controlled fields while the legacy adapter has a different, smaller field model. Autofill/readiness must not depend on competing definitions.

### K04 — Readiness presentation leakage
`useReadiness` exposes score and detailed checks directly to Dashboard consumers. Home should eventually consume a simplified booking state and keep detailed diagnostics out of the primary user flow.

## P1 — Product UX

### K05 — ProfileCard legacy terminology/fallbacks
ProfileCard is service-aware but still contains fallback behavior and Special-Entry-centric defaults. It should use canonical active service information.

### K06 — General Details service logic in UI
GeneralDetailsSection contains service-specific branches. Those rules should eventually come from canonical service configuration.

### K07 — Home complexity
Dashboard contains many advanced surfaces. The final Home should prioritize release update, contextual booking state, one dominant CTA, simple how-it-works and quick actions.

## P1 — Reliability

### K08 — Settings runtime verification
Settings contain multiple behavior toggles. Each toggle must be traced from UI → storage → runtime consumer → observable behavior.

### K09 — Tailwind compatibility
The declared project version is Tailwind 3.4.x. Utility classes used by the project must be checked against that version; unsupported utilities should not be silently assumed to work.

### K10 — Full test/build evidence
Repository inspection cannot establish that the current master builds/tests successfully in the present environment. A reproducible local/CI verification is required.

## P2 — Maintainability

### K11 — Legacy adapters
Legacy service adapters remain useful for backward compatibility but should not become a second source of service truth.

### K12 — Product state contract
A dedicated BookingCockpit/BookingState adapter is recommended between domain engines and UI.

## Safety constraints

No issue above justifies:
- CAPTCHA bypass
- OTP automation
- payment automation
- final booking submission automation
- queue manipulation
- TTD lock bypass
- forcing disabled/read-only fields
- automatic declarations/attestations
- sensitive logging
