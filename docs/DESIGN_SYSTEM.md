# Tirumala SevaPilot — Design System Architecture

## 1. Overview & Philosophy

The SevaPilot Design System (`src/sidepanel/design-system`) provides a cohesive, premium, and spiritually grounded visual framework.

Designed for high readability, trustworthy interaction feedback, and low anxiety during high-traffic quota release rushes, the design language balances:
- **Devotional Elegance**: Deep spiritual purple (`#54258A`) paired with restrained temple gold (`#D4A72C`).
- **Warm & Calm Surfaces**: Warm ivory (`#FFFDF7` / `#FAF7F2`) and carefully balanced dark plum (`#1E1028` / `#2C1A35`).
- **Strict Accessibility & Contrast**: Conformance to WCAG 2.1 AA with high-contrast text (>4.5:1), visible focus rings (`focus-visible:outline-2`), and system reduced-motion support.

---

## 2. Core Tokens (`tokens.ts`)

### Color Palette

| Token | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- |
| `brand.primary` | `#54258A` | `#A855F7` | Brand actions, primary CTA, active navigation |
| `brand.accentGold` | `#D4A72C` | `#FBBF24` | Accent highlight, ticket price badges, gold CTA |
| `surface.light` | `#FFFDF7` | `#211526` | App background |
| `surface.lightAlt` | `#FAF8F5` | `#2A1A31` | Secondary card background |
| `surface.darkCard` | `#2E1E36` | `#2C1A35` | Elevated dark card surface |
| `semantic.success` | `#237A57` | `#4ADE80` | Verified fields, ready state |
| `semantic.warning` | `#B45309` | `#FBBF24` | Action required, pending field notice |
| `semantic.danger` | `#B91C1C` | `#F87171` | Emergency stop, severe block, data purge |
| `text.primary` | `#321B3F` | `#F8EFD8` | Primary readable headings & labels |
| `text.secondary` | `#6B5A70` | `#D4C3E0` | Subtitles and explanatory text |

### Accessibility & Reduced Motion
- **Reduced Motion**: Full support for `prefers-reduced-motion: reduce` in `index.css` disabling decorative transforms and transitions.
- **Focus Rings**: Standardized `focus-visible:outline-2` with 2px offset on all interactive primitives.
- **Hit Targets**: All interactive elements maintain WCAG AA touch/click minimum dimensions (≥36px for compact controls, 44px–48px for primary actions).

---

## 3. Component Primitives

### A. PageHeader (`PageHeader.tsx`)
Standardized header component deployed across all secondary screens:
```tsx
import { PageHeader } from '../design-system';

<PageHeader
  title={t('settings.title')}
  subtitle={t('settings.subtitle')}
  onBack={onBack}
  action={<button className="sp-btn-primary">Action</button>}
/>
```
- Reusable serif heading, descriptive subtitle, accessible back navigation button, optional badge and action button.

### B. Button (`Button.tsx`)
```tsx
import { Button } from './design-system';

<Button variant="primary" size="lg" fullWidth onClick={handleFill}>
  ⚡ FILL & VERIFY
</Button>
```
- **Variants**: `primary`, `secondary`, `outline`, `ghost`, `danger`, `gold`.
- **Sizes**: `sm` (36px min height), `md` (44px min height), `lg` (48px min height).
- **Features**: Accessible focus rings, loading spinners, leading & trailing icons.

### C. Badge (`Badge.tsx`)
```tsx
<Badge variant="ready" showDot size="md">
  Ready to Book
</Badge>
```
- **Variants**: `ready`, `working`, `actionRequired`, `blocked`, `completed`, `neutral`, `gold`.

### D. Card (`Card.tsx`)
- Standardized padding scales, subtle border outlines, and dark-mode responsive surfaces.

### E. Dialog (`Dialog.tsx`)
- Accessible modal behavior, `Escape` key close listener, focus-trapping background overlay.

### F. Icon (`Icon.tsx`)
- Curated SVG icons rendered with `aria-hidden="true"` and standardized sizing.

