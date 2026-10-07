# Tirumala SevaPilot — Phase 0 Architecture Baseline

Date: 2026-10-07
Baseline commit: 0c926cb8eb558be77f9051b60ca37cd910c7587a
Version: 1.1.0

## Confirmed architecture

- Chrome Manifest V3.
- React 18 side panel with Vite/CRXJS.
- Content-script autofill pipeline with service/workflow detection, row detection, field resolution, field transactions, verification and retry.
- Service-specific workflow registry currently contains Special Entry Darshan ₹300, Padmavathi/Sri PAT ₹200, Sri Srinivasa Divyanugraha Homam, and Srivari Seva.
- `useReadiness` delegates domain evaluation to `ReadinessEngine`.
- Profiles and pilgrim selection are service-key aware in `useProfiles`.
- Temporary TTD booking-lock handling exists in the dashboard/autofill flow.
- Release calendar has official-source validation, confirmation state, stale/expiry concepts and IST countdown logic.
- Srivari Seva has a dedicated workflow with explicit user-controlled declaration/fitness classifications.

## Important current implementation observations

### Readiness
The domain engine is substantially centralized, but the UI-facing `useReadiness` still exposes detailed score/check data. A later product-state adapter is recommended so Home consumes only READY / ACTION REQUIRED / NOT READY while Diagnostics retains detailed checks.

### Workflow/service separation
The workflow registry is service-specific and has route dominance for SPAT and Srivari. This is a strong foundation. Service configuration and legacy service adapters still overlap, so Phase 1 should define canonical ownership rather than introduce another parallel rules system.

### Home
Dashboard already contains contextual CTA logic, release ticker, upcoming releases, how-it-works, diagnostics and temporary-lock state. The remaining product work is consolidation and removal of internal diagnostics from the primary Home experience, not a complete rewrite.

### Profiles
`useProfiles` correctly uses serviceId as the effective selection key and enforces max pilgrim limits. `ProfileCard` is partly service-aware but retains legacy fallbacks and terminology that should be removed in a later service-aware UX phase.

### General Details
`GeneralDetailsSection` already distinguishes Padmavathi, Homam and Srivari. It should eventually consume canonical service rules instead of maintaining its own service-condition logic.

### Srivari
The dedicated workflow defines required/optional/user-controlled fields. The separate legacy Srivari adapter has different limits/field definitions, creating a potential source of contradictory behavior.

### Release intelligence
The release calendar is architecturally sophisticated, but it contains a static verified-event seed. Exact current release information must remain tied to fresh official TTD announcements; stale/static entries must not be presented as current confirmation.

### Security/permissions
Manifest permissions include storage, sidePanel, activeTab, scripting, tabs and contextMenus. Host permissions are limited to the two configured TTD domains. A later security phase should verify each permission is actually required and remove unused permissions.

## Known architectural risks

1. Canonical service rules vs legacy service adapters are not fully unified.
2. UI readiness state is richer than the desired consumer-facing state model.
3. Static release seed data can become stale even though stale/expiry checks exist.
4. Srivari has potentially conflicting max-pilgrim/field definitions between workflow and adapter.
5. General Details service logic is partly duplicated in UI rather than being entirely domain-driven.
6. Tailwind 3 project must be checked for utilities that are not native to the declared Tailwind version.
7. Settings/runtime integration needs explicit verification for every toggle.
8. The Home contains several feature surfaces and needs a strict single-primary-CTA hierarchy.
9. Duplicate editor compatibility should be checked even though the page editor currently bridges to the component editor.
10. Full build/test status requires execution in a local environment; repository inspection alone is not evidence of passing tests.

## Phase 0 scope conclusion

The project should evolve incrementally. A rewrite is not justified. The existing autofill and workflow architecture is suitable as the foundation for the product roadmap, provided the next phases establish canonical domain contracts and remove contradictory legacy paths.
