# Tirumala SevaPilot — End-to-End User Journeys (Phase 13)

## Journey 1: First-Time Pilgrim Setup (Zero Frustration)

```mermaid
graph TD
    A[Install SevaPilot Extension] --> B[Open Sidepanel]
    B --> C[Home Screen: Setup Needed]
    C -->|Single dominant CTA| D[Click CREATE PROFILE]
    D --> E[Enter Pilgrim Name, Age, Gender, Photo ID]
    E --> F[Enter Contact Email & Pincode]
    F --> G[Save Profile]
    G --> H[Home Screen Updates to: Ready to Book]
```

1. **First Opening**: The user is greeted by a clean Home screen without percentage clutter or diagnostic errors.
2. **Clear Direction**: The hero card clearly states: *"No profile yet. Complete your profile to prepare for fast booking."*
3. **Primary Action**: Clicking the large purple `CREATE PROFILE` button opens the Profile form directly.
4. **Instant Validation**: Verhoeff checksum validates Aadhaar in real-time, preventing typo rejections during live drops.
5. **Immediate Readiness**: Saving returns the user to Home, where the status instantly becomes `Ready to Book`.

---

## Journey 2: Pre-Booking Readiness Verification (The Morning of Quota Drop)

```mermaid
graph TD
    A[Open SevaPilot 30 mins before release] --> B[Select Target Service]
    B --> C[Click 'Test My Profile' in More]
    C --> D[Pre-flight Verification runs against Canonical Rules]
    D --> E{All checks pass?}
    E -->|Yes| F[Screen shows: 100% Prepared for Booking]
    E -->|No| G[Shows exact missing field e.g. Gothram]
    G --> H[Click 'Fix Profile' to resolve]
```

1. **Service Selection**: The user selects their target service (e.g. ₹300 Special Entry Darshan or ₹1600 Homam).
2. **Pre-Flight Test**: User taps `Test My Profile` to verify all requirements against official TTD rules without touching the live portal.
3. **Peace of Mind**: Receives instant confirmation that name formatting, age brackets, photo ID, and service-specific rules are 100% satisfied.

---

## Journey 3: Live Booking Rush (Under High Traffic)

```mermaid
graph TD
    A[TTD Portal Opens at 10:00 AM] --> B[Enter TTD Digital Queue]
    B --> C[SevaPilot detects Queue: 'In Queue' status]
    C --> D[Calm wait timer: '~8 mins wait. Keep tab open']
    D --> E[Queue Admits User to Calendar/Slot Selection]
    E --> F[User selects Date & Time Slot]
    F --> G[TTD Form Page Loads]
    G --> H[SevaPilot Hero glows: ⚡ FILL & VERIFY]
    H -->|User clicks primary CTA| I[Autofill populates and verifies fields in <200ms]
    I --> J[User boundary: User solves CAPTCHA & completes Payment]
```

1. **Queue Safety**: User is placed into the TTD virtual queue. SevaPilot enters passive queue monitoring with calm messaging ("Safe queue monitoring active. Do not refresh.").
2. **Admission**: Once admitted, user selects their date and slot.
3. **One-Click Execution**: As soon as the devotee form appears, the hero CTA turns into `⚡ FILL & VERIFY`.
4. **Sub-200ms Population**: SevaPilot populates all pilgrim rows and verifies DOM synchronization.
5. **Human Boundaries**: The user independently solves the CAPTCHA and proceeds to payment, adhering strictly to TTD terms.

---

## Journey 4: Temporary Booking Lock Recovery

```mermaid
graph TD
    A[Network drop or slot conflict occurs] --> B[TTD displays temporary session hold]
    B --> C[SevaPilot detects lock safely]
    C --> D[Hero changes to: Temporarily Blocked]
    D --> E[Options presented: CHECK BOOKING HISTORY or TRY AGAIN]
    E --> F[User checks history or waits for token expiration]
```

1. **No Panic**: When TTD returns a temporary lock ("slot held by another session"), SevaPilot calmly informs the user that TTD holds slot tokens for a short duration.
2. **Clear Alternatives**: Provides a one-click button to check official booking history in case the ticket was already generated, or retry once released.
