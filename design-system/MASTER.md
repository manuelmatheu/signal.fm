# signal.fm — Design System

> **Usage:** When building a specific page, check `design-system/pages/[page-name].md` first.
> If that file exists, its rules **override** this file. Otherwise follow this file exclusively.

---

**Project:** signal.fm  
**Style:** Dark Mode (OLED) — OLED blacks, warm accent, frosted glass, cinematic music-forward  
**Font:** Inter (Google Fonts)  
**Stack:** Vanilla JS, no framework, no build step

---

## Color Tokens

All colors are defined as CSS custom properties in `tokens.css`. Never hardcode hex values in CSS rules.

### Dark theme (default)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#080808` | Page background (true OLED black) |
| `--bg-2` | `#0e0e0e` | Slightly elevated background |
| `--surface` | `#141414` | Card and panel backgrounds |
| `--surface-2` | `#1c1c1c` | Elevated surface (hover states, inputs) |
| `--border` | `#1e1e1e` | Subtle dividers |
| `--border-s` | `#2c2c2c` | Stronger borders, hover borders |
| `--fg` | `#f0ece8` | Primary text |
| `--fg-2` | `#807870` | Secondary / muted text |
| `--fg-3` | `#484038` | Tertiary text, labels, placeholders |
| `--accent` | `#e87040` | Brand orange — CTAs, highlights, now-playing |
| `--accent-glow` | `rgba(232,112,64,0.28)` | Shadow glow on accent elements |
| `--accent-dim` | `rgba(232,112,64,0.14)` | Focus ring fill |
| `--purple` | `#c084fc` | Artist similarity signal |
| `--purple-bg` | `rgba(192,132,252,0.12)` | Artist similarity badge background |
| `--teal` | `#34d399` | Track similarity signal |
| `--teal-bg` | `rgba(52,211,153,0.12)` | Track similarity badge background |
| `--coral` | `#fb7185` | New releases signal |
| `--coral-bg` | `rgba(251,113,133,0.12)` | New releases badge background |
| `--card-shadow` | `0 4px 24px rgba(0,0,0,0.56)` | Default card elevation |
| `--card-shadow-hover` | `0 10px 48px rgba(0,0,0,0.76)` | Hovered card elevation |
| `--input-bg` | `#181818` | Input field backgrounds |
| `--hover` | `rgba(255,255,255,0.04)` | Hover tint on dark surfaces |
| `--hover-s` | `rgba(255,255,255,0.07)` | Stronger hover tint (icon buttons) |
| `--header-bg` | `rgba(8,8,8,0.88)` | Frosted glass header |
| `--player-bg` | `rgba(10,10,10,0.88)` | Frosted glass player bar |
| `--player-border` | `rgba(255,255,255,0.07)` | Player bar top border |
| `--progress-bg` | `#282828` | Progress bar track |
| `--progress-fill` | `var(--accent)` | Progress bar fill |

### Light theme overrides (`[data-theme="light"]`)

| Token | Value |
|---|---|
| `--bg` | `#f6f4f1` |
| `--surface` | `#ffffff` |
| `--fg` | `#18181b` |
| `--fg-2` | `#6b6760` |
| `--accent` | `#c55f38` |
| `--purple` | `#7c3aed` |
| `--teal` | `#059669` |
| `--coral` | `#e11d48` |
| `--header-bg` | `rgba(246,244,241,0.88)` |
| `--player-bg` | `rgba(252,250,248,0.92)` |

Full light token values are in `tokens.css`.

---

## Typography

**Font:** Inter — loaded via Google Fonts  
`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')`

Add `<link rel="preconnect">` tags in `<head>` before the stylesheet for zero-FOIT.

### Type scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page heading | `1.9rem` | 700 | Welcome screen h2 |
| Section heading | `1.1rem` | 700 | Logo, major headings |
| Body | `0.92rem` | 400 | Descriptions, paragraphs |
| UI / label | `0.84–0.87rem` | 500–600 | Buttons, track names |
| Secondary | `0.77–0.82rem` | 400 | Artist names, metadata |
| Caption / badge | `0.62–0.68rem` | 600 | Badges, timestamps |

**Letter spacing:**
- Headings: `-0.04em` to `-0.05em`
- Sidebar labels / all-caps: `0.1em`
- Badge text: `0.04em`
- Body: default (0)

**Line height:** `1.3` for card titles, `1.55–1.65` for body paragraphs.

**Rendering:** Always set `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale` on `body`.

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-s` | `6px` | Inputs, small buttons, player art |
| `--radius-m` | `10px` | Cards, signal icon boxes, large buttons |
| `--radius-l` | `16px` | Reserved for modals, large panels |
| `100px` | pill | Badges, source labels |
| `50%` | circle | Icon buttons |

---

## Spacing

8px grid system. Use multiples of 4px or 8px for all padding/gaps.

| Context | Value |
|---|---|
| Inline icon gap | `6–8px` |
| Card body padding | `11–12px` |
| Card footer padding | `3px 8px 9px 12px` |
| Feed grid gap | `14px` |
| Feed container padding | `24px` |
| Sidebar padding | `24px 20px` |
| Sidebar section gap | `32px` |
| Header height | `56px` |
| Player bar height | `80px` (mobile: `66px`) |

---

## Elevation & Shadows

Three levels of elevation. Never use arbitrary shadow values.

| Level | Token | Value |
|---|---|---|
| Card (resting) | `--card-shadow` | `0 4px 24px rgba(0,0,0,0.56)` |
| Card (hover) | `--card-shadow-hover` | `0 10px 48px rgba(0,0,0,0.76)` |
| Now playing | — | `0 0 0 1px var(--accent), 0 0 28px var(--accent-glow)` |
| Player art | — | `0 2px 12px rgba(0,0,0,0.35)` |

For frosted glass surfaces (header, player bar): `backdrop-filter: blur(20–24px) saturate(180%)`.

---

## Motion

All transitions use `cubic-bezier(0.0, 0.0, 0.2, 1)` (ease-out) unless noted.

| Interaction | Duration | Property |
|---|---|---|
| Hover state change | `150ms` | background, color, border-color |
| Card lift on hover | `200ms` | transform, box-shadow |
| Album art zoom | `380ms` | transform (scale 1.04) |
| Card entrance | `280ms` | opacity + translateY(10px → 0) |
| Play button press | `150ms` | transform (scale 1.06), box-shadow |
| Progress bar height | `150ms` | height (3px → 5px on hover) |
| Progress bar fill | `0.3s linear` | width |

**Always** include `@media (prefers-reduced-motion: reduce)` with `animation-duration: 0.01ms !important` and `transition-duration: 0.01ms !important`.

---

## Components

### Buttons

- Primary: `--accent` background, white text, transparent border. Hover: `opacity 0.88` + glow shadow.
- Secondary: transparent background, `--border-s` border.
- Size variants: `.btn-small` (`5px 10px`), default (`8px 16px`), `.btn-large` (`13px 30px`).
- All buttons: `font-family: inherit`, `font-weight: 500`, `font-size: 0.82rem`.

### Icon buttons

- 36×36px circle, transparent background, `--fg-2` color.
- Hover: `--hover-s` background, `--fg` color.
- Play button exception: `--accent` background, white, scale on hover.

### Cards (`.track-card`)

- Background: `--surface`, border: `--border`, radius: `--radius-m`.
- Hover: `translateY(-3px)` + `--card-shadow-hover` + `--border-s` border.
- Now playing: accent border + ambient glow (no competing `animation` property).
- Album art: `aspect-ratio: 1`, `object-fit: cover`, zoom `scale(1.04)` on parent hover.

### Badges / source labels

Tinted pill style — **never** solid white-on-color.
- Artist similarity: `--purple-bg` background, `--purple` text.
- Track similarity: `--teal-bg` background, `--teal` text.
- New releases: `--coral-bg` background, `--coral` text.

### Player bar

- Frosted glass: `backdrop-filter: blur(24px) saturate(180%)`.
- Background: `--player-bg` (semi-transparent), border: `--player-border`.
- Player art: 52px, `--radius-s`, box-shadow for depth.
- Progress bar: 3px default, 5px on hover (height transition only, not layout shift).

### Input fields

- Background: `--input-bg`, border: `--border-s`, radius: `--radius-s`.
- Focus: `--accent` border + `0 0 0 3px var(--accent-dim)` ring.
- Placeholder: `--fg-3` color.

### Signal icon boxes (welcome screen)

- 36×36px, `border-radius: 8px`.
- Artist: `--purple-bg` background, `--purple` icon.
- Track: `--teal-bg` background, `--teal` icon.
- Release: `--coral-bg` background, `--coral` icon.

---

## Layout

- Max content width: `1200px`, centered.
- Header: sticky, `z-index: 100`.
- Sidebar: `256px` wide, sticky at `top: 56px`, hidden at ≤768px.
- Feed: `grid`, `minmax(190px, 1fr)`, `14px` gap.
- Player bar: fixed bottom, `z-index: 200`. `body.has-player` adds `padding-bottom: 90px`.

### Breakpoints

| Breakpoint | Layout change |
|---|---|
| `≤768px` | Sidebar hidden, feed columns `minmax(148px, 1fr)`, player bar compressed to 66px, volume hidden |

---

## Icons

Use inline SVG only. Stroke-based, `stroke-width: 2`, `stroke-linecap: round`, `stroke-linejoin: round`. No emoji as icons. Consistent 18px size for UI icons, 22px for player controls.

---

## Anti-patterns

- No hardcoded hex values in component CSS — always use tokens
- No emoji as structural icons
- No `color` as the only differentiator (always pair with icon/text)
- No animation on `width`/`height` — use `transform` and `opacity` only
- No competing `animation` shorthand when a transition is already applied
- No horizontal scroll at any breakpoint
- No content hidden behind fixed bars (player/header) without matching padding

---

## Pre-delivery checklist

- [ ] All colors use CSS token variables
- [ ] No emojis as icons — SVG only
- [ ] `cursor: pointer` on all interactive elements
- [ ] Hover transitions 150–300ms ease-out
- [ ] Focus states visible (accent border + ring)
- [ ] `prefers-reduced-motion` media query included
- [ ] Text contrast ≥4.5:1 (check both light and dark themes independently)
- [ ] No horizontal scroll at 375px
- [ ] `body.has-player` padding accounts for player bar
- [ ] Album art has `aspect-ratio: 1` and `object-fit: cover`
