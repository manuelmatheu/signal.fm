# Page-specific overrides

Place page-level design overrides here. Each file should only document
**deviations from MASTER.md** — not repeat what's already defined globally.

## Naming

`[page-name].md` — e.g. `feed.md`, `onboarding.md`, `settings.md`

## How Claude uses these

When building a specific page, Claude checks this folder first:
- If `[page-name].md` exists → its rules override MASTER.md
- If not → MASTER.md applies exclusively

## What belongs here

- Layout deviations (different grid, full-bleed, etc.)
- Page-specific color treatment (e.g. a dark hero on a light-theme page)
- Component variants used only on this page
- Typography exceptions (larger hero type, etc.)

## What does NOT belong here

- Token definitions (those live in tokens.css)
- Global component rules (those live in MASTER.md)
- Anything that applies to more than one page
