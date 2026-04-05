# Discovery Novelty Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop known seed artists from appearing as recommendations, prevent duplicate artists in the feed, expand similarity graph to 2 hops, and fix Last.fm `auth.getSession` POST bug.

**Architecture:** Four targeted changes across three files — a known-artist filter and artist-dedup Set in the candidate pipeline (`seeds.js` + `config.js`), 2nd-hop expansion inside `expandFromArtist` (`seeds.js`), artist tracking on render (`ui.js`), and switching `auth.getSession` from GET to POST (`lastfm.js`).

**Tech Stack:** Vanilla JS, no build step. Spotify Web API, Last.fm API.

---

## Files

- Modify: `js/config.js` — add `heardArtists` global Set
- Modify: `js/seeds.js` — `isKnownArtist()` helper, 2nd-hop in `expandFromArtist`, artist filter + dedup in `fetchCandidates()`
- Modify: `js/ui.js` — populate `heardArtists` in `renderTracks()`
- Modify: `js/lastfm.js` — fix `exchangeLfmToken` to use POST

---

### Task 1: Fix Last.fm `auth.getSession` POST bug

**Files:**
- Modify: `js/lastfm.js:92-110`

Last.fm requires signed auth calls (`auth.getSession`) to be sent as HTTP POST with form-encoded body. The current code sends a GET, causing error 13 (invalid method signature).

- [ ] **Step 1: Change `exchangeLfmToken` to POST**

Replace the function body in `js/lastfm.js`:

```js
async function exchangeLfmToken(token) {
  var params = { method: 'auth.getSession', api_key: LFM_KEY, token: token };
  params.api_sig = lfmSign(params);
  params.format = 'json';
  var body = new URLSearchParams(params);
  var resp = await fetch(LFM_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!resp.ok) {
    var errBody = await resp.json().catch(function() { return {}; });
    console.warn('Last.fm session exchange failed', resp.status, 'error:', errBody.error, errBody.message);
    return null;
  }
  var data = await resp.json();
  if (data && data.session && data.session.key) {
    LFM_SESSION_KEY = data.session.key;
    localStorage.setItem('signal_lfm_session', LFM_SESSION_KEY);
    return LFM_SESSION_KEY;
  }
  console.warn('Last.fm session exchange error', data);
  return null;
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/lastfm.js
```

Expected: no output (clean).

- [ ] **Step 3: Manual test**

Open the app, click "Connect Last.fm", complete the auth flow. Check the console — should no longer show error 13. `localStorage.getItem('signal_lfm_session')` should be set.

- [ ] **Step 4: Commit**

```bash
git add js/lastfm.js
git commit -m "fix: send auth.getSession as POST to fix Last.fm error 13"
```

---

### Task 2: Add `heardArtists` global Set

**Files:**
- Modify: `js/config.js`

- [ ] **Step 1: Add `heardArtists` after `heardUris` in `config.js`**

Find the line:
```js
var heardUris = new Set();      // Spotify URIs already shown in feed
```

Add immediately after it:
```js
var heardArtists = new Set();   // artist names already shown this session (lowercase)
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/config.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/config.js
git commit -m "feat: add heardArtists Set for artist-level dedup"
```

---

### Task 3: Add `isKnownArtist` helper and known-artist filter

**Files:**
- Modify: `js/seeds.js`

`isKnownArtist(name)` returns true if the artist (case-insensitive) is already a key in `seedPool.artists`. Applied in `fetchCandidates()` to strip known artists from all non-`new_release` candidates.

- [ ] **Step 1: Add `isKnownArtist` helper at the top of `seeds.js`, after the artist ID cache block (after line 28)**

```js
// ---- Known-artist filter ----

function isKnownArtist(name) {
  if (!name) return false;
  var lower = name.toLowerCase();
  var keys = Object.keys(seedPool.artists);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) return true;
  }
  return false;
}
```

- [ ] **Step 2: Apply filter in `fetchCandidates()` before the shuffle**

Find this comment near the end of `fetchCandidates()`:
```js
  // Shuffle all candidates
```

Insert the following block immediately before it:

```js
  // Filter known seed artists from discovery signals (keep new_release exempt)
  // Also filter artists already shown this session
  all = all.filter(function(c) {
    if (!c.artist) return true;
    var lower = c.artist.toLowerCase();
    if (heardArtists.has(lower)) return false;
    if (c._source !== 'new_release' && isKnownArtist(c.artist)) return false;
    return true;
  });

```

- [ ] **Step 3: Syntax check**

```bash
node --check js/seeds.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add js/seeds.js
git commit -m "feat: filter known seed artists and heard artists from candidates"
```

---

### Task 4: Populate `heardArtists` on render

**Files:**
- Modify: `js/ui.js`

`heardArtists` must be populated when tracks are rendered, so subsequent batch fetches can filter against it.

- [ ] **Step 1: Find the `heardUris` population in `renderTracks()`**

In `js/ui.js`, search for the place where `heardUris` is populated. It will look like:

```js
heardUris.add(t.uri);
```

or it may be in the `loadMoreTracks` / feed generation pipeline. Search with:

```bash
grep -n "heardUris" js/ui.js js/seeds.js js/player.js
```

- [ ] **Step 2: Add `heardArtists` population alongside `heardUris`**

Wherever `heardUris.add(t.uri)` appears (may be in `ui.js` or called from a batch-loading function), add the line immediately after it:

```js
if (t.artist) heardArtists.add(t.artist.toLowerCase());
```

If `heardUris` is populated inside `renderTracks()` in `ui.js`, add it there. If it's populated elsewhere (e.g. in a batch-loading loop in `ui.js`), add it in that same location.

- [ ] **Step 3: Syntax check**

```bash
node --check js/ui.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js
git commit -m "feat: track rendered artists in heardArtists for dedup"
```

---

### Task 5: 2nd-hop expansion in `expandFromArtist`

**Files:**
- Modify: `js/seeds.js:89-122`

Replace the current top-3 logic with a mixed 1st-hop + 2nd-hop pool (2 + 2 artists), filtering seed artists from both hops.

- [ ] **Step 1: Replace `expandFromArtist` with the 2nd-hop version**

Replace the entire `expandFromArtist` function (lines 89–122) with:

```js
async function expandFromArtist(seedArtistName) {
  var market = userMarket || 'US';
  var trackCandidates = [];

  // 1st-hop: similar artists from Last.fm
  var similar1 = await getSimilarArtists(seedArtistName, 20);
  var hop1 = similar1.filter(function(a) { return !isKnownArtist(a.name); });

  // 2nd-hop: similar artists of the top 1st-hop result
  var hop2 = [];
  if (hop1.length > 0) {
    var pivot = hop1[0].name;
    var similar2 = await getSimilarArtists(pivot, 20);
    hop2 = similar2.filter(function(a) {
      return !isKnownArtist(a.name) && a.name.toLowerCase() !== seedArtistName.toLowerCase();
    });
  }

  // Mix: 2 from 1st-hop + 2 from 2nd-hop
  var pool = hop1.slice(0, 2).concat(hop2.slice(0, 2));

  for (var j = 0; j < pool.length; j++) {
    var name = pool[j].name;
    var data = await spGet('/search?q=artist:' + encodeURIComponent(name) + '&type=track&limit=3&market=' + market);
    if (!data || !data.tracks || !data.tracks.items) continue;

    for (var k = 0; k < data.tracks.items.length; k++) {
      var t = data.tracks.items[k];
      if (t.artists[0].name.toLowerCase() !== name.toLowerCase()) continue;
      trackCandidates.push({
        uri: t.uri,
        id: t.id,
        name: t.name,
        artist: t.artists[0].name,
        artistId: t.artists[0].id,
        duration: t.duration_ms,
        albumArt: t.album.images[1] ? t.album.images[1].url : (t.album.images[0] ? t.album.images[0].url : ''),
        mbid: null,
        _source: 'artist_similar',
        _sourceDetail: seedArtistName,
        _resolved: true
      });
    }
  }

  return trackCandidates;
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/seeds.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/seeds.js
git commit -m "feat: expand artist similarity to 2nd hop for deeper discovery"
```

---

### Task 6: Smoke test end-to-end

- [ ] **Step 1: Open `index.html` in a browser (or served locally)**

- [ ] **Step 2: Authenticate with Spotify, let the feed load**

- [ ] **Step 3: Open the browser console and verify:**

  - No JS errors
  - Feed loads tracks
  - Source badges appear (`Similar to X`, `Because you liked X`, `New release`, `Deep cut`)

- [ ] **Step 4: Verify no seed artist appears in discovery signals**

  Open the console and run:
  ```js
  var seedNames = Object.keys(seedPool.artists).map(function(n) { return n.toLowerCase(); });
  var violations = sessionFeed.filter(function(t) {
    return t._source !== 'new_release' && seedNames.indexOf(t.artist.toLowerCase()) !== -1;
  });
  console.log('Known-artist violations:', violations.length, violations.map(function(t) { return t.artist; }));
  ```
  Expected: `Known-artist violations: 0`

- [ ] **Step 5: Verify no artist appears twice**

  ```js
  var artists = sessionFeed.map(function(t) { return t.artist.toLowerCase(); });
  var dupes = artists.filter(function(a, i) { return artists.indexOf(a) !== i; });
  console.log('Duplicate artists:', dupes.length, [...new Set(dupes)]);
  ```
  Expected: `Duplicate artists: 0`

- [ ] **Step 6: Commit if any minor fixes were needed, otherwise done**
