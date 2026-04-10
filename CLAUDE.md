# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is signal.fm?

signal.fm is a passive music discovery web app -- a living feed of tracks the user hasn't heard yet,
driven by what they already love. Five signals feed the discovery engine: artist similarity, track
similarity, new releases, deep cuts, and Last.fm personalized recommendations. The user scrolls,
listens, likes, and the feed adapts in real time.

**Repo:** https://github.com/manuelmatheu/signal-fm
**Live:** https://signal-fm.vercel.app/
**Stack:** Vanilla JS, no framework, no build step. Spotify Web API + Web Playback SDK + Last.fm API.

---

## Commands

There is no build step. Open `index.html` directly in a browser or serve with any static file server.

**Syntax check before committing:**
```
node --check js/config.js
node --check js/spotify.js
node --check js/lastfm.js
node --check js/seeds.js
node --check js/player.js
node --check js/ui.js
```

**Deploy:** Push to `main` -- Vercel auto-deploys.

---

## Architecture

### Script load order (strict -- no modules)

```html
<script src="https://sdk.scdn.co/spotify-player.js"></script>
<script src="js/config.js"></script>     <!-- globals first -->
<script src="js/spotify.js"></script>    <!-- auth + API helpers + matchToSpotify -->
<script src="js/lastfm.js"></script>     <!-- Last.fm API calls + auth -->
<script src="js/seeds.js"></script>      <!-- seed pool build, expand, reweight, new releases -->
<script src="js/player.js"></script>     <!-- SDK events, polling fallback, player bar -->
<script src="js/ui.js"></script>         <!-- feed render, infinite scroll, signal toggles, init() -->
```

All functions and variables are global (`var`). No modules, no build step, no bundler.

### Design system

The visual design is documented in `DESIGN.md` -- "The Neon Pulse" (deep purple void / electric neon accent).
Key rules: no 1px solid borders (use background shifts instead), no pure grey, glassmorphism player bar,
cinematic ambient background layer driven by current album art.

CSS variables in `:root` (light) and `[data-theme="dark"]` (dark). Theme stored in
`localStorage('mixtape_theme')`. Inline IIFE in `<head>` applies theme before render.
Never hardcode hex values in CSS -- always use tokens.

---

## The five discovery signals

All five feed into a shared candidate pool, deduplicated by Spotify URI, then rendered as
track cards with a source badge. Signals can be toggled via `signalWeights` in `config.js`.

| Signal | Key | Source | Badge color |
|---|---|---|---|
| Artist similarity | `artistSimilar` | `artist.getSimilar` (Last.fm) | purple |
| Track similarity | `trackSimilar` | `track.getSimilar` (Last.fm) | teal |
| New releases | `newReleases` | Spotify album search | coral |
| Deep cuts | `deepCuts` | `artist.getTopTracks` positions 11-30 | gold |
| Last.fm recommendations | `lfmRecommended` | `user.getRecommendedTracks` (requires session key) | -- |

`fetchCandidates()` in `seeds.js` runs all active signals in parallel via `Promise.all`.
New releases skip `matchToSpotify()` -- already Spotify-native. All other signals need it.

New releases use Spotify search (`/search?q=artist:...&type=album`) instead of `/artists/{id}/albums`
to avoid 403 catalog restriction errors. Capped to top 5 seed artists (`NEW_RELEASE_MAX_ARTISTS`).

---

## Seed pool

The seed pool is the core of personalization -- a weighted map driving all five signals.

```js
// config.js -- all globals use var
var seedPool = {
  artists: {},   // { 'Radiohead': 1.0, 'Portishead': 0.8 }
  tracks: {}     // { 'name|artist': 1.0 }
};

var signalWeights = {
  artistSimilar:  true,
  trackSimilar:   true,
  newReleases:    true,
  deepCuts:       true,
  lfmRecommended: true
};

var heardUris = new Set();      // Spotify URIs already shown in feed
var heardArtists = new Set();   // artist names shown this session (lowercase) -- cross-signal dedup
var sessionFeed = [];           // ordered array of resolved track objects
var candidateBuffer = [];       // pre-generated next batch
var isLoadingMore = false;      // infinite scroll + queue refill guard

// Player state
var spotifyPlayer = null;
var currentTrack = null;
var isPlaying = false;
var likedSet = new Set();
var pollTimer = null;
var userMarket = null;

// Last.fm session
var LFM_SESSION_KEY = localStorage.getItem('signal_lfm_session') || null;
```

### Seed pool build on load (`seeds.js`)

1. Spotify top artists (`medium_term` ~6 months) -- weight 1.0
2. Last.fm recent scrobbles (if username set) -- weight += 0.1 per play
3. Cache Spotify artist IDs immediately for top artists
4. Store build date in `localStorage('signal_seeds_date')` -- daily rotation rebuilds if >24h old

### Reweighting on interaction

- `onLike(track)` in `seeds.js`: boost artist weight +0.3 (cap 1.5), add `name|artist` to `seedPool.tracks`
- `onSkip(track)` in `seeds.js`: deprioritize artist -0.2 (floor 0.1)

### Artist ID resolution (`seeds.js`)

Last.fm returns artist names; Spotify needs IDs. Cache name->ID in `localStorage('signal_artist_ids')`
with 24h TTL. Check cache before falling back to Spotify search.

### 2nd-hop expansion (`expandFromArtist`)

Takes 2 similar artists from 1st hop + 2 unique artists from 2nd hop (similar-of-similar).
`heardArtists` prevents showing the same artist twice in a session across any signal.

---

## Spotify integration

### OAuth (PKCE, no backend)

`startAuth()` -> redirect -> `exchangeCode(code)` -> store tokens in localStorage.
`REDIRECT_URI = window.location.origin + window.location.pathname` -- adapts to any domain.

Scopes include `user-top-read` (required for `/me/top/artists`) -- not present in SpotiMix.

### Web Playback SDK

Device named "signal.fm". `sdkReady` and `sdkDeviceId` globals track availability.
`pollNowPlaying()` fallback at 5s interval for mobile.

### Key API patterns

- Playlist creation: always `/me/playlists`, NOT `/users/{id}/playlists` (avoids 403)
- Liked songs: body required for `PUT /me/tracks`
- New releases: use `/search?q=artist:...&type=album` instead of `/artists/{id}/albums` (avoids 403)
- Spotify may return a new refresh token on refresh -- always overwrite stored value

### Queue refill (`checkQueueRefill` in `ui.js`)

Called on each track change. When the user is 3 tracks from the end of `sessionFeed`, it loads
the next batch and re-issues `spotifyPlay(allUris, currentIdx)` to keep Spotify's native queue
in sync. Seeks back to the saved position to avoid audible interruption.

---

## Last.fm integration

```js
var LFM_KEY = '...';    // read-only, safe to expose
var LFM_SECRET = '...'; // used only for API signature -- treat as sensitive
```

| Function | Endpoint | Purpose |
|---|---|---|
| `getSimilarArtists(name)` | `artist.getSimilar` | Expand seed artists |
| `getSimilarTracks(name, artist)` | `track.getSimilar` | Expand seed tracks |
| `getArtistDeepCuts(name)` | `artist.getTopTracks` | Positions 11-30 (skip hits) |
| `getUserRecentTracks(user)` | `user.getRecentTracks` | Optional Last.fm seeding |
| `getLfmRecommendedTracks(limit)` | `user.getRecommendedTracks` | Requires session key |

`track.getSimilar` returns MusicBrainz IDs -- `matchToSpotify()` handles both mbid and name+artist fallback.

### Last.fm OAuth (session key)

`startLfmAuth()` opens a popup to `last.fm/api/auth`. The callback page postMessages the token back.
`exchangeLfmToken(token)` calls `auth.getSession` (POST with MD5 API signature) -> stores session key
in `localStorage('signal_lfm_session')` and `LFM_SESSION_KEY` global.

API signatures use a compact inline MD5 implementation in `lastfm.js` -- SubtleCrypto doesn't support MD5.
`lfmSign(params)` sorts non-`format` params alphabetically, concatenates key+value pairs, appends `LFM_SECRET`, returns MD5 hex.

---

## Feed and player

### Feed rendering (`ui.js`)

`renderTracks(tracks)` appends playlist-style rows to `#feed`. Infinite scroll via `IntersectionObserver`
on `#feed-sentinel` (200px rootMargin). `isLoadingMore` guards against concurrent fetches.

`loadNextBatch()` drains `candidateBuffer` first; if empty, calls `fetchCandidates()`. Resolved tracks
(already have Spotify URI) skip `matchToSpotify()`. Non-resolved tracks get a 120ms throttle between
Spotify search calls to avoid 429s.

### Player bar

Fixed bottom, hidden until first playback. `body.has-player` adds padding.
SDK `player_state_changed` events drive updates; `pollNowPlaying()` is the remote fallback.
`highlightNowPlaying(uri)` highlights the active row in the feed.

### Cinematic ambient layer

Two fixed `<img>` elements (`#ambient-img-a`, `#ambient-img-b`) crossfade (1.4s ease) on track change,
driven by `updateAmbient(artUrl)` in `player.js`. Album art is blurred (80px) and saturated (1.8x)
at `z-index: -2`. A `body::before` gradient overlay sits at `z-index: -1` for readability.
`changelog.html` opts out with `body::before { display: none }`.

Key globals: `_ambientUseA` (bool toggle), `_ambientLastUrl` (dedup guard).

---

## localStorage keys

| Key | Purpose |
|---|---|
| `mixtape_theme` | Theme (`'dark'` / `'light'`) |
| `spotify_token` / `spotify_refresh` | OAuth tokens |
| `spotify_token_expiry` | Token expiry timestamp (ms) |
| `signal_lfm_username` | Optional Last.fm username (for recent scrobbles) |
| `signal_lfm_session` | Last.fm session key (for personalized recommendations) |
| `signal_artist_ids` | Artist name -> Spotify ID cache (24h TTL) |
| `signal_seeds_date` | Last seed pool build time (ISO timestamp) |

---

## Gotchas

- `track.getSimilar` returns mbid, not Spotify URI -- `matchToSpotify()` handles both
- `heardArtists` filters artists across all signals; `heardUris` filters individual tracks
- New releases: use Spotify search, not `/artists/{id}/albums` -- the latter 403s in Development Mode
- `LFM_SECRET` is in `config.js` -- do not push a real secret to a public repo
- Spotify may return a new refresh token on refresh -- always overwrite stored value
- Pre-generate `candidateBuffer` in background while user listens to prevent scroll spinners
- ASCII-only in HTML comments

---

## Additional pages

- `index.html` -- the main app
- `changelog.html` -- standalone reading page; same CSS/theme IIFE, opts out of ambient layer

---

## Current development status

Phases 1-3 complete (v0.3): core feed, all signals, signal toggles, Last.fm connect, feedback loop.
Phase 4 (daily refresh, save as playlist, heard-tracks persistence) is next. See `ROADMAP.md`.

---

## Deployment and git

- Vercel auto-deploys from `main`. Add each deployment URL as redirect URI in Spotify Dashboard.
- Hard refresh (Cmd+Shift+R) on mobile after deploys.
- Single `main` branch, direct pushes.

---

*Keep this file updated on every architectural change.*
