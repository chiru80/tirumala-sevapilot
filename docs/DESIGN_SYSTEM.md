# Tirumala SevaPilot — Design System Architecture

## 1. Overview & Philosophy

The SevaPilot Design System (`src/sidepanel/design-system`) provides a cohesive, premium, and spiritually grounded visual framework.

Designed for high readability and low anxiety during high-traffic quota release rushes, the design language balances:
- **Devotional Elegance**: Deep spiritual purple (`#54258A`) paired with auspicious gold (`#D4A72C`).
- **Modern Calm**: Crisp typography, high contrast, gentle elevations, and soothing status emeralds (`#2F8F68`).
- **Strict Accessibility**: Conformance to WCAG 2.1 AA with high-contrast text and visible focus rings.

---

## 2. Core Tokens (`tokens.ts`)

### Color Palette

| Token | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- |
| `primary` | `#54258A` | `#A855F7` | Brand actions, primary CTA, active navigation |
| `gold` | `#D4A72C` | `#FBBF24` | Accent highlight, ticket price badges, VIP actions |
| `success` | `#2F8F68` | `#4ADE80` | Ready status, 100% prepared, verified fields |
| `warning` | `#D97706` | `#F59E0B` | Incomplete fields, user action required |
| `danger` | `#E11D48` | `#F43F5E` | Emergency stop, severe block, deletion |
| `background` | `#FAF7F2` | `#1E1028` | Sidepanel main surface background |
| `surface` | `#FFFFFF` | `#2C1A35` | Card surfaces and elevation containers |
| `border` | `rgba(84,37,138,0.12)` | `rgba(212,167,44,0.18)` | Subtle component outlines |

### Typography & Spacing
- **Font Stack**: Modern system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with strict sizing:
  - `xs`: 12px / 16px (micro labels, secondary badges)
  - `sm`: 13px / 18px (body text, list items)
  - `base`: 14px / 20px (card headers, primary buttons)
  - `lg`: 16px / 24px (hero headlines)
  - `xl`: 18px / 26px (modal titles)
- **Radii**: Smooth curved corners (`rounded-xl` for buttons/badges, `rounded-2xl` for cards and dialogs).

---

## 3. Component Primitives

### A. Button (`Button.tsx`)
```tsx
import { Button } from './design-system';

<Button variant="primary" size="lg" fullWidth onClick={handleFill}>
  ⚡ FILL & VERIFY
</Button>
```
- **Variants**: `primary`, `secondary`, `outline`, `ghost`, `danger`, `gold`.
- **Sizes**: `sm` (36px min height), `md` (44px min height), `lg` (48px min height).
- **Features**: Accessible focus rings (`focus-visible:outline-2`), loading spinners, leading & trailing icons.

### B. Badge (`Badge.tsx`)
```tsx
<Badge variant="ready" showDot size="md">
  Ready to Book
</Badge>
```
- **Variants**: `ready`, `working`, `actionRequired`, `blocked`, `completed`, `neutral`, `gold`.
- **Features**: Optional animated pulse dot (`showDot`).

### C. Card (`Card.tsx`)
```tsx
<Card variant="elevated" padding="md">
  <h3>Active Profile</h3>
</Card>
```
- **Variants**: `default`, `elevated`, `outlined`, `ghost`.
- **Features**: Consistent padding scales (`none`, `sm`, `md`, `lg`), dark-mode responsive surfaces.

### D. Dialog (`Dialog.tsx`)
```tsx
<Dialog isOpen={isOpen} onClose={handleClose} title="Select Service">
  <div>Modal Content</div>
</Dialog>
```
- **Features**: Accessible modal behavior, `Escape` key close listener, focus-trapping background overlay.

### E. Icon (`Icon.tsx`)
24 carefully curated SVG icons rendered at stroke-width 2 with `aria-hidden="true"`:
`check`, `alert-circle`, `alert-triangle`, `clock`, `shield`, `sparkles`, `external-link`, `x`, `user`, `settings`, `refresh`, `copy`, `trash`, `edit`, `plus`, `chevron-right`, `chevron-down`, `info`, `home`, `arrow-right`, `lock`, `calendar`, `file-text`, `help-circle`.
