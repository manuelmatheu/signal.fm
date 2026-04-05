# Welcome Screen, Autoplay Fix & Ambient Blur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-generated feed on load with a centered "generate" screen, fix autoplay by gating it behind a user gesture, and reduce ambient background blur from 80px to 40px.

**Architecture:** Three independent changes — (1) a new `#generate-screen` element shown after seeds load, with the existing `#signal-filters` bar above it and a CTA button that triggers feed generation; (2) `loadNextBatch()` + `autoplayFirstTrack()` moved into the button's click handler so they run within a user gesture context; (3) two CSS value changes for blur.

**Tech Stack:** Vanilla JS (no modules), HTML, CSS custom properties. No build step.

---

## File Map

| File | Change |
|---|---|
| `index.html` | Add `#generate-screen` div after `#signal-filters` |
| `css/style.css` | Reduce blur values; add `.generate-screen` styles |
| `js/ui.js` | Refactor `init()` — show generate screen, move feed trigger to button click |

---

### Task 1: Reduce ambient blur

**Files:**
- Modify: `css/style.css` line 23 (desktop blur), line 1019 (mobile blur)

- [ ] **Step 1: Update desktop blur**

In `css/style.css`, find this block (around line 17):
```css
.ambient-img {
  position: absolute;
  inset: -80px;
  width: calc(100% + 160px);
  height: calc(100% + 160px);
  object-fit: cover;
  filter: blur(80px) saturate(1.8);
  opacity: 0;
  transition: opacity 1.4s ease;
  transform: scale(1.1);
}
```
Change `filter` to:
```css
  filter: blur(40px) saturate(1.6);
```

- [ ] **Step 2: Update mobile blur**

In `css/style.css`, find the media query block (around line 1019):
```css
  .ambient-img { filter: blur(60px) saturate(1.6); }
```
Change to:
```css
  .ambient-img { filter: blur(40px) saturate(1.4); }
```

- [ ] **Step 3: Verify visually**

Open `index.html` in a browser, connect Spotify, play a track. The ambient background should show noticeably more album art colour and shape than before.

- [ ] **Step 4: Syntax check and commit**

```bash
node --check js/config.js
```
```bash
git add css/style.css
git commit -m "fix: reduce ambient blur from 80px to 40px"
```

---

### Task 2: Add `#generate-screen` HTML

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the generate screen div**

In `index.html`, find the closing tag of `#signal-filters` (line ~116):
```html
        <span id="lfm-rec-status" style="display:none;"></span>
      </div>

      <!-- Feed context / liner notes -->
```
Insert the new `#generate-screen` div between `#signal-filters` and `<!-- Feed context -->`:
```html
        <span id="lfm-rec-status" style="display:none;"></span>
      </div>

      <!-- Generate screen (shown after seeds load, before feed is generated) -->
      <div id="generate-screen" class="generate-screen" style="display:none;">
        <div class="generate-screen-inner">
          <div class="generate-screen-icon">&#x1F4E1;</div>
          <h2 class="generate-screen-title">Your discovery feed</h2>
          <p class="generate-screen-tagline">Choose which signals to use, then generate your personal feed of tracks you haven't heard yet.</p>
          <button id="generate-feed-btn" class="btn btn-primary btn-large">Generate my feed &rarr;</button>
          <span id="generate-lfm-hint" class="generate-lfm-hint" style="display:none;">Connect Last.fm above for personalised picks</span>
        </div>
      </div>

      <!-- Feed context / liner notes -->
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add generate-screen HTML skeleton"
```

---

### Task 3: Style the generate screen

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add generate screen styles**

Add the following block to `css/style.css` after the `.welcome-screen` / `.welcome-content` rules (search for `.welcome-content` to find the right location, then add after its closing `}`):

```css
/* ---- Generate screen ---- */
.generate-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding: 40px 24px;
}

.generate-screen-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  max-width: 420px;
}

.generate-screen-icon {
  font-size: 40px;
  line-height: 1;
}

.generate-screen-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--fg);
  margin: 0;
  letter-spacing: -0.5px;
}

.generate-screen-tagline {
  color: var(--fg-3);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  max-width: 340px;
}

.generate-lfm-hint {
  color: var(--fg-3);
  font-size: 12px;
}

@media (max-width: 480px) {
  .generate-screen-title { font-size: 22px; }
  .generate-screen-tagline { font-size: 13px; }
}
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. The generate screen won't be visible yet (it's `display:none` until JS shows it), but run a quick syntax check:

```bash
node --check js/ui.js
```

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: style generate screen"
```

---

### Task 4: Wire generate screen in `init()`

**Files:**
- Modify: `js/ui.js` — `init()` function (lines 552–621)

This is the core change. After seeds load, instead of auto-generating the feed, show the generate screen and wait for the button click.

- [ ] **Step 1: Replace the connected-state section of `init()`**

Find this block in `js/ui.js` (lines 572–621):
```js
  // Connected state
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('disconnect-btn').style.display = '';
  document.getElementById('feed-loading').style.display = 'flex';

  document.getElementById('disconnect-btn').addEventListener('click', disconnectSpotify);
  document.getElementById('save-playlist-btn').addEventListener('click', savePlaylist);

  // Init SDK
  initSpotifySDK();

  // Build or rebuild seed pool
  if (needsSeedRebuild() || justConnected) {
    await buildSeedPool();
  } else {
    // Restore seed pool from top artists at minimum
    await buildSeedPool();
  }

  updateSeedDisplay();

  // Pre-seed heardUris with library tracks so they are excluded from the feed.
  // Also populate likedSet from the same data -- avoids needing /me/tracks/contains.
  var libraryUris = await fetchSavedTracks(500);
  for (var li = 0; li < libraryUris.length; li++) {
    heardUris.add(libraryUris[li]);
    var trackId = libraryUris[li].split(':')[2];
    if (trackId) likedSet.add(trackId);
  }

  // Show feed, hide loading
  document.getElementById('feed-loading').style.display = 'none';
  document.getElementById('feed').style.display = 'block';
  var filtersEl = document.getElementById('signal-filters');
  if (filtersEl) filtersEl.style.display = '';

  // Load first batch
  await loadNextBatch();

  // Show feed context
  renderFeedContext();

  // Autoplay first track
  autoplayFirstTrack();

  // Start polling fallback if SDK not ready after 5s
  setTimeout(function() {
    if (!sdkReady) startPollingFallback();
  }, 5000);
}
```

Replace it with:
```js
  // Connected state
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('disconnect-btn').style.display = '';
  document.getElementById('feed-loading').style.display = 'flex';

  document.getElementById('disconnect-btn').addEventListener('click', disconnectSpotify);
  document.getElementById('save-playlist-btn').addEventListener('click', savePlaylist);

  // Init SDK
  initSpotifySDK();

  // Build seed pool
  await buildSeedPool();
  updateSeedDisplay();

  // Pre-seed heardUris with library tracks so they are excluded from the feed.
  // Also populate likedSet from the same data.
  var libraryUris = await fetchSavedTracks(500);
  for (var li = 0; li < libraryUris.length; li++) {
    heardUris.add(libraryUris[li]);
    var trackId = libraryUris[li].split(':')[2];
    if (trackId) likedSet.add(trackId);
  }

  // Show signal filters + generate screen; hide loading
  document.getElementById('feed-loading').style.display = 'none';
  var filtersEl = document.getElementById('signal-filters');
  if (filtersEl) filtersEl.style.display = '';

  // Show Last.fm hint if not connected
  var lfmHint = document.getElementById('generate-lfm-hint');
  if (lfmHint && !LFM_SESSION_KEY) lfmHint.style.display = '';

  document.getElementById('generate-screen').style.display = 'flex';

  // Generate button -- runs inside a user gesture so autoplay works
  document.getElementById('generate-feed-btn').addEventListener('click', async function() {
    document.getElementById('generate-screen').style.display = 'none';
    document.getElementById('feed').style.display = 'block';

    await loadNextBatch();
    renderFeedContext();
    autoplayFirstTrack();

    // Start polling fallback if SDK not ready after 5s
    setTimeout(function() {
      if (!sdkReady) startPollingFallback();
    }, 5000);
  });
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/ui.js
```
Expected: no output (clean).

- [ ] **Step 3: Manual smoke test**

1. Open `index.html` in a browser (or `https://signal-fm.vercel.app/` after deploy).
2. If not connected: pre-auth welcome screen shows — unchanged.
3. Connect Spotify: loading spinner appears while seeds build.
4. Spinner disappears: signal chips bar + centered generate card visible.
5. Toggle a chip off: chip dims, `signalWeights` updates.
6. Click "Generate my feed →": generate card disappears, feed loads, first track autoplays without pressing play.
7. Verify ambient background shows more vivid colour (40px blur).

- [ ] **Step 4: Commit**

```bash
git add js/ui.js
git commit -m "feat: show generate screen before feed, fix autoplay via user gesture"
```

---

### Task 5: Push to production

- [ ] **Step 1: Push to main**

```bash
git push
```

Vercel auto-deploys from `main`. Hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) after deploy to pick up changes.
