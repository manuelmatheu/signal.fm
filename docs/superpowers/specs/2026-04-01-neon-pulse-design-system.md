# Design Spec: The Neon Pulse Design System

**Date:** 2026-04-01
**Scope:** Full visual overhaul of `css/style.css` — new color tokens (dark + light), font swap to Manrope, structural CSS changes (no section borders, pill CTAs, glassmorphism).
**Files changed:** `css/style.css`, `index.html` (font link only)

---

## Overview

Replace the current warm-orange / OLED-black / Inter design with "The Neon Pulse": a deep purple void dark mode paired with a pastel lavender light mode. The warm orange accent is retained for all CTAs and action elements. Manrope replaces Inter. Section borders are removed in favour of background shifts. Primary buttons become pill-shaped.

The light/dark toggle is preserved. No JS changes required — all existing CSS token names (`--bg`, `--surface`, `--accent`, etc.) are kept; only values change.

---

## 1. Color Tokens

### Dark mode (`[data-theme="dark"]`)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#16052a` | Deep purple void — page background |
| `--bg-2` | `#1c0b35` | Slightly elevated background |
| `--surface` | `#21103d` | Cards, feed container, panels |
| `--surface-2` | `#2a1850` | Hover states |
| `--border` | `rgba(185,162,208,0.10)` | Ghost border — felt, not seen |
| `--border-s` | `rgba(185,162,208,0.20)` | Interactive element outlines |
| `--fg` | `#e8e0f5` | Primary text (purple-tinted off-white) |
| `--fg-2` | `#b9a2d0` | Secondary / muted text |
| `--fg-3` | `#7a6490` | Labels, placeholders, track numbers |
| `--accent` | `#e87040` | Warm orange — CTAs, now-playing, progress |
| `--accent-glow` | `rgba(232,112,64,0.28)` | Button glow, now-playing art shadow |
| `--accent-dim` | `rgba(232,112,64,0.14)` | Focus ring fill, now-playing row tint |
| `--purple` | `#b6a0ff` | Artist similarity signal |
| `--purple-bg` | `rgba(182,160,255,0.12)` | Artist similarity badge background |
| `--teal` | `#34d399` | Track similarity signal |
| `--teal-bg` | `rgba(52,211,153,0.12)` | Track similarity badge background |
| `--coral` | `#ff6c95` | New releases signal |
| `--coral-bg` | `rgba(255,108,149,0.12)` | New releases badge background |
| `--card-shadow` | `0 4px 24px rgba(0,0,0,0.56)` | Resting elevation |
| `--card-shadow-hover` | `0 8px 64px rgba(182,160,255,0.08)` | Hover — ambient purple glow |
| `--input-bg` | `#120440` | Input field "well" |
| `--error-bg` | `#1a0a0a` | Error state background |
| `--hover` | `rgba(255,255,255,0.04)` | Subtle hover tint |
| `--hover-s` | `rgba(255,255,255,0.07)` | Stronger hover tint (icon buttons) |
| `--header-bg` | `rgba(22,5,42,0.88)` | Frosted glass header |
| `--player-bg` | `rgba(22,5,42,0.92)` | Frosted glass player bar |
| `--player-border` | `rgba(182,160,255,0.10)` | Player bar top edge |
| `--progress-bg` | `#3a2060` | Progress bar track |
| `--progress-fill` | `var(--accent)` | Progress bar fill |

### Light mode (`:root`)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#faf9ff` | Near-white with lavender tint |
| `--bg-2` | `#f0ecff` | Slightly elevated |
| `--surface` | `#ffffff` | Cards, panels |
| `--surface-2` | `#ede8ff` | Hover states |
| `--border` | `rgba(124,58,237,0.08)` | Ghost border |
| `--border-s` | `rgba(124,58,237,0.16)` | Interactive element outlines |
| `--fg` | `#1a0d2e` | Dark purple text |
| `--fg-2` | `#5a4875` | Muted text |
| `--fg-3` | `#9b88b8` | Labels, placeholders |
| `--accent` | `#c55f38` | Warm orange (darkened for light bg) |
| `--accent-glow` | `rgba(197,95,56,0.20)` | Button glow |
| `--accent-dim` | `rgba(197,95,56,0.10)` | Focus ring fill |
| `--purple` | `#7c3aed` | Artist similarity signal |
| `--purple-bg` | `rgba(124,58,237,0.10)` | Artist similarity badge |
| `--teal` | `#059669` | Track similarity signal |
| `--teal-bg` | `rgba(5,150,105,0.10)` | Track similarity badge |
| `--coral` | `#e0185a` | New releases signal |
| `--coral-bg` | `rgba(224,24,90,0.10)` | New releases badge |
| `--card-shadow` | `0 2px 12px rgba(124,58,237,0.07)` | Resting (purple-tinted) |
| `--card-shadow-hover` | `0 6px 32px rgba(124,58,237,0.12)` | Hover |
| `--input-bg` | `#f5f2ff` | Input field background |
| `--error-bg` | `#fff1f2` | Error state background |
| `--hover` | `rgba(0,0,0,0.04)` | Hover tint |
| `--hover-s` | `rgba(0,0,0,0.07)` | Stronger hover tint |
| `--header-bg` | `rgba(250,249,255,0.88)` | Frosted glass header |
| `--player-bg` | `rgba(252,250,255,0.92)` | Frosted glass player bar |
| `--player-border` | `rgba(124,58,237,0.07)` | Player bar top edge |
| `--progress-bg` | `#ddd8f0` | Progress bar track |
| `--progress-fill` | `var(--accent)` | Progress bar fill |

---

## 2. Typography

**Font:** Manrope (replaces Inter)

Update `index.html` `<link>` tags:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
```

Update `style.css` `@import` and `font-family` on `body`:
```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
body { font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

Weight roles are unchanged: 800 for logo, 700 for headings, 600 for track names/UI, 500 for buttons, 400 for secondary text.

---

## 3. Structural CSS Changes

### 3a. Remove section borders

Remove `border-bottom`/`border-right` from structural dividers. Sections separate via background color shift.

Elements to update:
- `.app-header` — remove `border-bottom: 1px solid var(--border)`
- `.sidebar` — remove `border-right: 1px solid var(--border)`
- `.track-item` — remove `border-bottom: 1px solid var(--border)`
- `.track-list` — remove `border: 1px solid var(--border)`
- `.signal-card` in welcome screen — remove `border: 1px solid var(--border)`

Keep borders on:
- `.btn` (ghost interactive outline, uses `--border-s`)
- `.input-field` (uses `--border-s`, focus uses `--accent`)
- `.player-bar` top edge (uses `--player-border`)

### 3b. Pill primary buttons

```css
.btn-primary { border-radius: 100px; }
.btn-large   { border-radius: 100px; } /* overrides existing var(--radius-m) */
```

Secondary/ghost buttons keep `--radius-s` (6px) for visual hierarchy. `.btn` base class keeps its existing `border-radius: var(--radius-s)` unchanged.

### 3c. Glassmorphism — values already in tokens

`--header-bg` and `--player-bg` updated to new deep-purple-tinted values. No structural CSS change needed; `backdrop-filter: blur(24px) saturate(180%)` stays as-is.

---

## 4. What Does NOT Change

- CSS token names — all existing references in JS are safe
- Layout structure (sidebar width, feed grid, breakpoints)
- Component markup in `index.html` (except font link)
- Animation/motion values
- `@media (prefers-reduced-motion)` block
- Responsive breakpoints
- All JS files

---

## 5. Implementation Order

1. Update font `<link>` in `index.html`
2. Replace `@import` in `style.css`
3. Replace `:root` token block (light mode)
4. Replace `[data-theme="dark"]` token block
5. Update `font-family` on `body`
6. Remove section borders (header, sidebar, track-item, track-list, signal-card)
7. Apply pill radius to `.btn-primary` and `.btn-large`
8. Syntax-check: `node --check` on all JS files (tokens are CSS-only, no JS impact expected)
