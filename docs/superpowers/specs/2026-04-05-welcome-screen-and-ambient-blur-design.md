# Design: Welcome Screen, Generate Feed Button, Ambient Blur Reduction

Date: 2026-04-05

## Overview

Three related improvements to the post-login experience:

1. **Welcome screen for connected users** — instead of immediately generating the feed, show a centered intro screen with a brief explanation, interactive signal toggles, and a "Generate my feed" button.
2. **Autoplay fix** — gate feed generation behind a user gesture (the generate button click), which gives the Spotify SDK a valid interaction context and makes autoplay reliable.
3. **Ambient blur reduction** — reduce background blur from 80px to 40px so album art atmosphere is more visible.

---

## 1. Welcome Screen (connected users)

### Layout — Option A: Centered card

When the user is authenticated but hasn't generated a feed yet, show a full-height centered card instead of the loading spinner + auto-generated feed.

**Structure:**
```
📡
Your discovery feed
[tagline: "Choose which signals to use, then generate your personal feed of tracks you haven't heard yet."]

[signal chips — same interactive toggles as current header bar]

[Generate my feed →]  ← primary CTA

[Connect Last.fm for personalized picks]  ← secondary, shown only if not connected
```

**Behavior:**
- Signal chips on the welcome screen are the real `signalWeights` toggles — same checkboxes, same `initSignalToggles()` wiring. No duplication.
- Clicking "Generate my feed →" triggers `loadNextBatch()` and `autoplayFirstTrack()`, then hides the welcome screen and shows the feed + signal filter bar.
- The welcome screen is shown once per session (not persisted). On page reload after a feed has been seen, skip directly to the feed as today.
- "Connect Last.fm" link is hidden if `LFM_SESSION_KEY` is already set.

### State machine

```
connected + no feed seen this session → show welcome screen
connected + feed already generated    → skip welcome, show feed (current behavior)
not connected                         → show existing pre-auth welcome screen (no change)
```

A simple in-memory flag `var feedGenerated = false` (in `config.js` or top of `ui.js`) tracks whether the feed has been generated this session.

---

## 2. Autoplay Fix

The root cause: `autoplayFirstTrack()` is currently called after an async chain that starts at page load — no user gesture in scope. Browsers (and the Spotify SDK) require a user interaction to initiate audio.

**Fix:** move `loadNextBatch()` + `autoplayFirstTrack()` into the click handler of "Generate my feed →". Since the click is a direct user gesture, the entire async chain following it qualifies as gesture-initiated, making Spotify SDK `play()` calls succeed.

No changes to `autoplayFirstTrack()` itself — just its call site.

---

## 3. Ambient Blur Reduction

| Location | Before | After |
|---|---|---|
| Desktop (`.ambient-img`) | `blur(80px) saturate(1.8)` | `blur(40px) saturate(1.6)` |
| Mobile (`@media max-width:768px`) | `blur(60px) saturate(1.6)` | `blur(40px) saturate(1.4)` |

Opacity and transition values stay the same.

---

## Files to modify

- `css/style.css` — blur values on `.ambient-img` (desktop + mobile media query)
- `js/ui.js` — `init()`: show welcome screen instead of auto-generating; add generate button handler that calls `loadNextBatch()` + `autoplayFirstTrack()`
- `index.html` — add welcome screen markup for connected users (centered card with signal chips + generate button), or reuse/extend the existing `#welcome-screen` element

---

## What doesn't change

- The existing pre-auth welcome screen (shown when not connected) is untouched.
- Signal toggles in the header bar remain after the feed is generated.
- All seed building, Last.fm seeding, and `heardUris` pre-population still happen in `init()` before showing the welcome screen (loading spinner covers this as today).
- `renderFeedContext()` is still called after feed generation.

---

## Verification

1. Load the app while authenticated — should see loading spinner briefly, then the centered welcome card (not the feed).
2. Toggle a signal chip off and back on — chip animates, `signalWeights` updates.
3. Click "Generate my feed →" — feed appears, first track autoplays without needing to press play.
4. Reload the page — loading spinner, then welcome screen again (session reset).
5. Playing a track — ambient background shows album art with noticeably more visible color (40px blur vs old 80px).
