# Neon Pulse Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Inter/OLED-black/warm-orange design with The Neon Pulse — deep purple void dark mode, pastel lavender light mode, Manrope font, no section borders, pill CTAs — by updating `css/style.css` and `index.html` only.

**Architecture:** All changes are in two files. CSS custom property names are unchanged so no JS edits are needed. Tasks are ordered so each produces a visually coherent intermediate state.

**Tech Stack:** Vanilla CSS custom properties, Google Fonts (Manrope), no build step.

---

## Files

| File | Change |
|---|---|
| `index.html` | Swap Inter font `<link>` for Manrope |
| `css/style.css` | Update `@import`, `body` font-family, `:root` tokens, `[data-theme="dark"]` tokens, remove 5 section borders, pill primary buttons |

---

## Task 1: Swap font — index.html + style.css

**Files:**
- Modify: `index.html` (lines 7–9)
- Modify: `css/style.css` (line 4, line 99–100)

- [ ] **Step 1: Add the Manrope font link in index.html**

  The preconnect tags already exist. Insert the Manrope stylesheet link between them and the `css/style.css` link:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="css/style.css">
  ```

- [ ] **Step 2: Update @import in style.css**

  Replace line 4:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  ```
  With:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
  ```

- [ ] **Step 3: Update font-family on body**

  In the `body` rule (~line 99), replace:
  ```css
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  ```
  With:
  ```css
  font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  ```

- [ ] **Step 4: Verify**

  Open `index.html` in a browser. All text should render in Manrope (geometric, slightly wider than Inter). The colour scheme is unchanged at this point.

- [ ] **Step 5: Commit**

  ```bash
  git add index.html css/style.css
  git commit -m "style: swap Inter for Manrope font"
  ```

---

## Task 2: Replace light mode tokens (:root)

**Files:**
- Modify: `css/style.css` (the `:root { ... }` block, lines 9–51)

- [ ] **Step 1: Replace the entire :root block**

  Find and replace the full `:root { ... }` block. The new block is:

  ```css
  /* ---- Design tokens: Light (Pastel Neon) ---- */
  :root {
    --bg:            #faf9ff;
    --bg-2:          #f0ecff;
    --surface:       #ffffff;
    --surface-2:     #ede8ff;
    --border:        rgba(124, 58, 237, 0.08);
    --border-s:      rgba(124, 58, 237, 0.16);
    --fg:            #1a0d2e;
    --fg-2:          #5a4875;
    --fg-3:          #9b88b8;

    --accent:        #c55f38;
    --accent-glow:   rgba(197, 95, 56, 0.20);
    --accent-dim:    rgba(197, 95, 56, 0.10);

    --purple:        #7c3aed;
    --purple-bg:     rgba(124, 58, 237, 0.10);
    --teal:          #059669;
    --teal-bg:       rgba(5, 150, 105, 0.10);
    --coral:         #e0185a;
    --coral-bg:      rgba(224, 24, 90, 0.10);

    --card-shadow:       0 2px 12px rgba(124, 58, 237, 0.07);
    --card-shadow-hover: 0 6px 32px rgba(124, 58, 237, 0.12);
    --input-bg:      #f5f2ff;
    --error-bg:      #fff1f2;
    --hover:         rgba(0, 0, 0, 0.04);
    --hover-s:       rgba(0, 0, 0, 0.07);

    --header-bg:     rgba(250, 249, 255, 0.88);
    --player-bg:     rgba(252, 250, 255, 0.92);
    --player-border: rgba(124, 58, 237, 0.07);
    --progress-bg:   #ddd8f0;
    --progress-fill: var(--accent);

    --radius-s: 6px;
    --radius-m: 10px;
    --radius-l: 16px;

    --ease-out:      cubic-bezier(0.0, 0.0, 0.2, 1);
    --ease-in-out:   cubic-bezier(0.4, 0.0, 0.2, 1);
  }
  ```

- [ ] **Step 2: Verify light mode**

  Open `index.html` in a browser (light mode, no `data-theme="dark"` on `<html>`). Expected:
  - Background: pale lavender-white `#faf9ff`
  - Text: dark purple `#1a0d2e`
  - Accent (Connect button, logo dot): warm orange `#c55f38`
  - Signal badges: purple/teal/pink tints

- [ ] **Step 3: Commit**

  ```bash
  git add css/style.css
  git commit -m "style: update light mode tokens to Pastel Neon palette"
  ```

---

## Task 3: Replace dark mode tokens ([data-theme="dark"])

**Files:**
- Modify: `css/style.css` (the `[data-theme="dark"] { ... }` block, lines 53–88)

- [ ] **Step 1: Replace the entire [data-theme="dark"] block**

  Find and replace the full `[data-theme="dark"] { ... }` block. The new block is:

  ```css
  /* ---- Design tokens: Dark (Neon Pulse) ---- */
  [data-theme="dark"] {
    --bg:            #16052a;
    --bg-2:          #1c0b35;
    --surface:       #21103d;
    --surface-2:     #2a1850;
    --border:        rgba(185, 162, 208, 0.10);
    --border-s:      rgba(185, 162, 208, 0.20);
    --fg:            #e8e0f5;
    --fg-2:          #b9a2d0;
    --fg-3:          #7a6490;

    --accent:        #e87040;
    --accent-glow:   rgba(232, 112, 64, 0.28);
    --accent-dim:    rgba(232, 112, 64, 0.14);

    --purple:        #b6a0ff;
    --purple-bg:     rgba(182, 160, 255, 0.12);
    --teal:          #34d399;
    --teal-bg:       rgba(52, 211, 153, 0.12);
    --coral:         #ff6c95;
    --coral-bg:      rgba(255, 108, 149, 0.12);

    --card-shadow:       0 4px 24px rgba(0, 0, 0, 0.56);
    --card-shadow-hover: 0 8px 64px rgba(182, 160, 255, 0.08);
    --input-bg:      #120440;
    --error-bg:      #1a0a0a;
    --hover:         rgba(255, 255, 255, 0.04);
    --hover-s:       rgba(255, 255, 255, 0.07);

    --header-bg:     rgba(22, 5, 42, 0.88);
    --player-bg:     rgba(22, 5, 42, 0.92);
    --player-border: rgba(182, 160, 255, 0.10);
    --progress-bg:   #3a2060;
    --progress-fill: var(--accent);
  }
  ```

- [ ] **Step 2: Verify dark mode**

  Toggle dark mode in the browser (the theme toggle button or set `data-theme="dark"` on `<html>` in devtools). Expected:
  - Background: deep purple void `#16052a`
  - Text: purple-tinted off-white `#e8e0f5`
  - Accent (Connect button, logo dot, play button): warm orange `#e87040`
  - Artist similarity signal badges: soft purple `#b6a0ff`
  - Track similarity badges: teal `#34d399`
  - New release badges: pink `#ff6c95`

- [ ] **Step 3: Commit**

  ```bash
  git add css/style.css
  git commit -m "style: update dark mode tokens to Neon Pulse palette"
  ```

---

## Task 4: Remove section borders

**Files:**
- Modify: `css/style.css` (5 targeted removals)

- [ ] **Step 1: Remove border from .app-header**

  In the `.app-header` rule, remove:
  ```css
  border-bottom: 1px solid var(--border);
  ```
  The header already has `background: var(--header-bg)` which visually separates it via the frosted glass effect.

- [ ] **Step 2: Remove border from .sidebar**

  In the `.sidebar` rule, remove:
  ```css
  border-right: 1px solid var(--border);
  ```
  The sidebar separates from the feed via the `--bg` vs `--surface` background shift.

- [ ] **Step 3: Remove borders from .track-item**

  In the `.track-item` rule, remove:
  ```css
  border-bottom: 1px solid var(--border);
  ```
  Also remove the now-redundant last-child rule entirely:
  ```css
  .track-item:last-child { border-bottom: none; }
  ```

- [ ] **Step 4: Remove border from .track-list**

  In the `.track-list` rule, remove:
  ```css
  border: 1px solid var(--border);
  ```

- [ ] **Step 5: Remove border from .signal-card**

  In the `.signal-card` rule, remove:
  ```css
  border: 1px solid var(--border);
  ```

- [ ] **Step 6: Verify**

  Open both light and dark modes. Check:
  - Header flows into page with no visible line (frosted glass only)
  - Sidebar has no right border — background shift separates it from feed
  - Track rows have no divider lines between them
  - Feed list has no outer border box
  - Welcome screen signal cards have no border (background only)

- [ ] **Step 7: Commit**

  ```bash
  git add css/style.css
  git commit -m "style: remove section borders, use background shifts for separation"
  ```

---

## Task 5: Pill CTA buttons + final check

**Files:**
- Modify: `css/style.css` (`.btn-primary` and `.btn-large` rules)

- [ ] **Step 1: Add border-radius to .btn-primary**

  In the `.btn-primary` rule, add:
  ```css
  .btn-primary {
    background: var(--accent);
    color: #fff;
    border-color: transparent;
    border-radius: 100px;
  }
  ```

- [ ] **Step 2: Update border-radius on .btn-large**

  In the `.btn-large` rule, replace `border-radius: var(--radius-m)` with `border-radius: 100px`:
  ```css
  .btn-large { padding: 13px 30px; font-size: 0.92rem; border-radius: 100px; }
  ```

- [ ] **Step 3: Verify buttons**

  Check in both light and dark modes:
  - "Connect Spotify" header button: pill shape, warm orange background
  - "Connect Spotify to start" welcome button: pill shape, larger
  - "Save" (Last.fm) and "Disconnect" buttons: still rectangular (`--radius-s`), as expected

- [ ] **Step 4: Run syntax check on all JS files**

  ```bash
  node --check js/config.js && \
  node --check js/spotify.js && \
  node --check js/lastfm.js && \
  node --check js/seeds.js && \
  node --check js/player.js && \
  node --check js/ui.js
  ```

  Expected output: no output (all pass silently). Any output indicates a syntax error — investigate before committing.

- [ ] **Step 5: Final visual check**

  Open `index.html` and verify the full app in both themes:
  - Dark: deep purple void, orange CTA, frosted glass header/player, no divider lines, pill buttons
  - Light: lavender-tinted white, same orange CTA, purple-tinted shadows, pill buttons
  - Toggle theme — transition should be smooth

- [ ] **Step 6: Commit**

  ```bash
  git add css/style.css
  git commit -m "style: pill shape for primary CTAs; complete Neon Pulse design system"
  ```
