```markdown
# Design System Strategy: The Sonic Immersive

## 1. Overview & Creative North Star: "The Neon Pulse"
This design system is built to move beyond the static "playlist grid." Our North Star is **The Neon Pulse**—an editorial approach to music discovery that treats digital space like a high-end fashion magazine fused with a late-night subterranean club.

We break the "template" look by rejecting the rigid, centered grid in favor of **Intentional Asymmetry**. We utilize overlapping elements—where typography bleeds over imagery and containers float across section boundaries—to create a sense of kinetic energy. The goal is to make the user feel as though the interface is vibrating with the music it hosts.

## 2. Color & Tonal Architecture
The palette is a high-contrast interplay between the void (`background: #16052a`) and electric energy (`secondary: #00e3fd`).

* **Primary (`#b6a0ff`) & Tertiary (`#ff6c95`):** Use these for melodic accents. They represent the "soul" of the brand.
* **Secondary (`#00e3fd`):** This is our "Electric Neon." Use it sparingly for high-action items to maintain its punch.
* **The "No-Line" Rule:** Under no circumstances are 1px solid borders to be used for sectioning. We define boundaries through **Background Shifts**. A section transition should feel like moving between rooms in a club, not crossing a line on a map. Transition from `surface` to `surface-container-low` to signal a change in content.
* **The "Glass & Gradient" Rule:** For hero sections and primary CTAs, use a subtle linear gradient from `primary` to `primary_container`. For floating player controls or navigation, apply a "Glassmorphism" effect: use `surface_bright` at 60% opacity with a `24px` backdrop-blur.
* **Signature Textures:** Incorporate a subtle noise texture (3% opacity) over `surface_container` areas to provide a tactile, analog feel that grounds the digital neon colors.

## 3. Typography: The Editorial Voice
Our typography is the lead instrument. We pair the geometric structure of **Epilogue** with the fluid readability of **Manrope** and the technical "glitch" aesthetic of **Space Grotesk**.

* **Display & Headline (Epilogue):** These are your "Posters." Use `display-lg` for hero statements. Apply tight letter-spacing (-0.04em) to make headlines feel like a single, powerful unit.
* **Title & Body (Manrope):** This is the "Narrative." Manrope provides a premium, clean bridge between the loud headlines and functional UI. Use `title-lg` for track names and artist bios.
* **Labels (Space Grotesk):** These are the "Metadata." Use `label-md` for BPM, genres, and timestamps. The monospaced-leaning nature of Space Grotesk adds a technical, "pro-audio" feel to the discovery experience.

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "pop"; we use light and layering to create "immersion."

* **The Layering Principle:** Stacking is our primary hierarchy tool.
* *Base:* `surface` (#16052a)
* *Section:* `surface_container_low`
* *Card:* `surface_container` or `surface_variant`
* **Ambient Shadows:** If an element must float (e.g., a "Now Playing" bar), use a shadow tinted with the `primary` color (`#b6a0ff`) at 8% opacity with a massive 64px blur. This mimics the glow of a neon sign rather than a generic shadow.
* **The "Ghost Border" Fallback:** For interactive inputs, use the `outline_variant` token at 15% opacity. It should be felt, not seen.
* **Glassmorphism & Depth:** Use `surface_bright` with a 40% alpha for sub-menus. The background colors must bleed through to maintain the "Vibrant" energy requested.

## 5. Components & Interface Elements

### Buttons
* **Primary:** A pill-shaped (`full` roundedness) container using the `secondary` (#00e3fd) color. Text should be `on_secondary`. On hover, apply a `secondary_fixed` glow.
* **Secondary/Ghost:** No background. Use `outline` at 20% opacity. Text in `primary`.
* **Tertiary:** No container. Underlined with a 2px `tertiary` weight on hover.

### Cards & Lists
* **No Dividers:** Absolute prohibition on horizontal lines. Use the **Spacing Scale** (`8` or `12` units) to create "White Space Breaths."
* **Album/Track Cards:** Use `surface_container_highest` for the hover state. The transition should be a soft fade (300ms ease-out).

### Input Fields
* **Search/Discovery Bar:** Use `surface_container_lowest` (Pure Black) to create a "well" in the UI. Label in `label-md` Space Grotesk.
* **Error States:** Use `error` (#ff6e84) for text, but never a solid red box. Use a subtle `error_container` glow behind the field.

### Specialized Music Components
* **Waveform Progress Bar:** Use `secondary` for played and `outline_variant` at 30% for unplayed.
* **Genre Chips:** Use `secondary_container` with `on_secondary_container` text. Roundedness should be `md` (0.75rem) to differentiate from the `full` roundness of Action Buttons.

## 6. Do’s and Don’ts

### Do:
* **Do** allow images to break the container. If an artist's head overlaps a headline, it’s a feature, not a bug.
* **Do** use high-contrast type scales. The jump from `body-md` to `display-lg` should be dramatic.
* **Do** use `secondary_fixed_dim` for icons to ensure they feel "lit" from within.

### Don’t:
* **Don't** use pure grey. Every "neutral" in this system is tinted with purple or blue to maintain the "Energetic" vibe.
* **Don't** use standard 16px padding everywhere. Use the **Spacing Scale** to create rhythmic variety (e.g., tight `2` for metadata, wide `16` for section margins).
* **Don't** use 100% white for body text. Use `on_surface_variant` (#b9a2d0) to reduce eye strain and maintain the premium, moody atmosphere.

---
**Director's Note:** This system is about the "Vibe." If a layout feels too organized or "safe," break a rule. Shift a column, enlarge a font, or add a glow. We are designing for music—it should never feel quiet.

---

## Changelog

### v0.4 — Immersive / Cinematic Layer (2026-04-02)

Added a cinematic ambient background system on top of the Neon Pulse base. The currently-playing track's album art becomes the atmosphere of the entire app — blurred, saturated, and crossfading between tracks.

**New: Ambient background system**
- Two fixed `<img>` elements (`#ambient-img-a`, `#ambient-img-b`) crossfade on track change (1.4s ease)
- `filter: blur(80px) saturate(1.8)` — art becomes color and mood, not detail
- Opacity: 0.35 dark / 0.20 light; reduced to 0.28 on mobile for performance
- `body::before` gradient overlay (top/bottom fade to `--bg`) keeps text readable over any album art palette
- Mobile: blur reduced to 60px

**New: Display typography**
- Added **DM Serif Display** as the display font for logo, welcome headline, and feed context title
- Welcome `h2` bumped to 2.8rem (2rem on mobile); weight 400 — the serif contrasts with Manrope's geometric body
- Logo uses DM Serif Display at 1.2rem, weight 400

**Updated: Player bar**
- `.is-playing` state: ambient glow shadow (`--accent-dim`) from below, transitions in over 0.6s
- Album art grows from 52px → 58px with `--accent-glow` box-shadow when playing
- Play button: `breathe` keyframe animation — subtle glow pulse every 3s while playing

**Updated: Feed cards**
- `.now-playing` row: accent left-border inset (3px) + album art glow
- `.track-item:hover`: `translateX(2px)` nudge reinforces forward momentum

**Updated: Welcome screen**
- CTA button: `cta-pulse` keyframe — glow expands and contracts every 2.8s

### v0.3 — Neon Pulse Design System (2026-04-01)

Full implementation of the Neon Pulse design system from this document.

- Dark theme: deep purple void (`#16052a`), warm orange accent (`#e87040`)
- Light theme: pastel lavender (`#faf9ff`), warm orange accent (`#c55f38`)
- Font: Manrope (400–800)
- Pill CTAs (`border-radius: 100px`), ghost borders, no section dividers
- Signal badges: purple / teal / coral / gold tinted pills
- Feed context / liner notes collapsible panel
- Mobile hamburger drawer with backdrop

### v0.1 — Initial design brief (2026-03-xx)

Original creative direction document establishing The Neon Pulse north star: editorial asymmetry, void-to-neon contrast, no-line rule, glassmorphism player bar.```