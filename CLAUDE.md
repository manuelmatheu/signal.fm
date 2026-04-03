# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is signal.fm?

signal.fm is a passive music discovery web app -- a living feed of tracks the user hasn't heard yet,
driven by what they already love. Four signals feed the discovery engine: artist similarity, track
similarity, new releases from favourite artists, and daily fresh rotation. The user scrolls, listens,
likes, and the feed adapts in real time.

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
<script src="js/lastfm.js"></script>     <!-- Last.fm API calls -->
<script src="js/seeds.js"></script>      <!-- seed pool build, expand, reweight, new releases -->
<script src="js/player.js"></script>     <!-- SDK events, polling fallback, player bar -->
<script src="js/ui.js"></script>         <!-- feed render, infinite scroll, signal toggles, init() -->
```

All functions and variables are global (`var`). No modules, no build step, no bundler.

### Theme system

CSS variables in `:root` (light) and `[data-theme="dark"]` (dark). Theme stored in
`localStorage('mixtape_theme')`. Inline IIFE in `<head>` applies theme before render.

Key CSS vars: `--bg`, `--bg-2`, `--fg`, `--fg-2`, `--fg-3`, `--surface`, `--surface-2`,
`--border`, `--border-s`, `--accent`, `--accent-glow`, `--accent-dim`, `--purple`,
`--purple-bg`, `--teal`, `--teal-bg`, `--coral`, `--coral-bg`, `--card-shadow`,
`--card-shadow-hover`, `--input-bg`, `--header-bg`, `--player-bg`, `--player-border`.

All token definitions live in `css/style.css` (`:root` for light, `[data-theme="dark"]` for dark).
Never hardcode hex values in CSS -- always use tokens.

---

## The four discovery signals

All four feed into a shared candidate pool, deduplicated by Spotify URI, then rendered as
track cards with a source badge. Signals can be toggled via `signalWeights` in config.js.

| Signal | Source | Badge |
|---|---|---|
| Artist similarity | `artist.getSimilar` (Last.fm) per seed artist | "Similar to [artist]" (purple) |
| Track similarity | `track.getSimilar` (Last.fm) per seed track | "Because you liked [track]" (teal) |
| New releases | Spotify `/artists/{id}/albums` | "New release" (coral) |
| Daily rotation | Rebuilt if `signal_seeds_date` > 24h old | any of the above |

New releases cap: top 5 seed artists only (`NEW_RELEASE_MAX_ARTISTS`) to limit API calls.
New release tracks skip `matchToSpotify()` -- already Spotify-native.

---

## Seed pool

The seed pool is the core of personalization -- a weighted map driving all four signals.

```js
// config.js -- all globals use var
var seedPool = {
  artists: {},   // { 'Radiohead': 1.0, 'Portishead': 0.8, 'Mogwai': 0.6 }
  tracks: {}     // { 'track_mbid_or_uri': 1.0 }
};

var signalWeights = { artistSimilar: true, trackSimilar: true, newReleases: true };

var NEW_RELEASE_WINDOW_DAYS = 180;
var NEW_RELEASE_MAX_ARTISTS = 5;
var FEED_BATCH_SIZE = 20;
var ARTIST_ID_CACHE_TTL = 86400000; // 24h in ms

var heardUris = new Set();      // Spotify URIs already shown in feed
var sessionFeed = [];           // ordered array of resolved track objects
var candidateBuffer = [];       // pre-generated next batch
var isLoadingMore = false;      // infinite scroll guard

// Player state
var spotifyPlayer = null;       // Web Playback SDK instance
var currentTrack = null;        // currently playing track object
var isPlaying = false;
var likedSet = new Set();       // URIs the user has liked
var pollTimer = null;           // setInterval handle for mobile fallback
var userMarket = null;          // ISO 3166-1 alpha-2 from /me
```

### Seed pool build on load (`seeds.js`)

1. Spotify top artists (`medium_term` ~6 months) -- weight 1.0
2. Last.fm recent scrobbles (if username set) -- weight += 0.1 per play
3. Cache Spotify artist IDs immediately for top artists

### Reweighting on interaction

- `onLike(track)`: boost artist weight +0.3 (cap 1.5), add track as seed, expand signals
- `onSkip(track)`: deprioritize artist -0.2 (floor 0.1)

### Artist ID resolution (`seeds.js`)

Last.fm returns artist names; Spotify needs IDs. Cache name->ID in `localStorage('signal_artist_ids')`
with 24h TTL. Check cache first, fall back to Spotify search.

---

## Spotify integration

### OAuth (PKCE, no backend)

`startAuth()` -> redirect -> `exchangeCode(code)` -> store tokens in localStorage.
`REDIRECT_URI = window.location.origin + window.location.pathname` -- adapts to any domain.

Scopes: `user-read-private`, `user-read-email`, `user-top-read`, `user-read-recently-played`,
`user-modify-playback-state`, `user-read-playback-state`, `user-read-currently-playing`,
`playlist-modify-public`, `playlist-modify-private`, `streaming`, `user-library-modify`,
`user-library-read`

Note: `user-top-read` is required for `GET /me/top/artists` -- not in SpotiMix.

### Web Playback SDK

Device named "signal.fm". `sdkReady` and `sdkDeviceId` globals track availability.
`pollNowPlaying()` fallback at 5s interval for mobile (SDK not supported on all mobile browsers).

### Key API patterns

- Playlist creation: always `/me/playlists`, NOT `/users/{id}/playlists` (avoids 403)
- Liked songs: body required for `PUT /me/tracks`
- Top artists: `GET /me/top/artists?limit=10&time_range=medium_term`
- New releases: `GET /artists/{id}/albums?include_groups=album,single&limit=10`
- Album tracks: `GET /albums/{albumId}/tracks?limit=3`

---

## Last.fm integration

```js
var LFM_KEY = '177b9e8ee70fe2325bfff606cfdaee23'; // read-only, safe to expose
```

| Function | Endpoint | Purpose |
|---|---|---|
| `getSimilarArtists(name)` | `artist.getSimilar` | Expand seed artists |
| `getSimilarTracks(name, artist)` | `track.getSimilar` | Expand seed tracks |
| `getUserRecentTracks(user)` | `user.getRecentTracks` | Optional Last.fm seeding |

`track.getSimilar` returns MusicBrainz IDs -- `matchToSpotify()` handles both mbid and name+artist fallback.

---

## Feed and player

### Feed rendering (`ui.js`)

`renderTracks(tracks)` appends cards to `#feed`. Each card: album art, name, artist, source badge,
heart button. Click card -> `playFromFeed(uri)`. Infinite scroll via `IntersectionObserver` on a
sentinel element (200px rootMargin). `isLoadingMore` prevents concurrent fetches.

### Player bar

Fixed bottom, hidden until first playback. `body.has-player` adds padding.
SDK `player_state_changed` events drive updates; `pollNowPlaying()` is the remote fallback.
`highlightNowPlaying(uri)` highlights the active card in the feed.

---

## localStorage keys

| Key | Purpose |
|---|---|
| `mixtape_theme` | Theme (`'dark'` / `'light'`) -- shared with SpotiMix |
| `spotify_token` / `spotify_refresh` | OAuth tokens |
| `signal_lfm_username` | Optional Last.fm username |
| `signal_artist_ids` | Artist name -> Spotify ID cache (24h TTL) |
| `signal_seeds_date` | Last seed pool build time (ISO timestamp) |
| `spotify_token_expiry` | Token expiry timestamp (ms) |

---

## Gotchas

- `track.getSimilar` returns mbid, not Spotify URI -- `matchToSpotify()` handles both
- New releases: `include_groups=album,single` required; cap to top 5 seed artists
- Artist ID resolution: check cache before searching Spotify
- Spotify may return a new refresh token on refresh -- always overwrite stored value
- `heardUris` deduplication is feed-level only (cleared on page reload)
- Pre-generate `candidateBuffer` in background while user listens
- ASCII-only in HTML comments

---

## Additional pages

- `index.html` -- the main app
- `changelog.html` -- standalone reading page; uses the same `css/style.css` and theme IIFE, but suppresses the ambient layer with `body::before { display: none }` via inline `<style>`. No JS beyond the theme IIFE.

---

## Cinematic ambient layer

Two fixed `<img>` elements (`#ambient-img-a`, `#ambient-img-b`) in `index.html` crossfade (1.4s ease) on each track change, driven by `updateAmbient(artUrl)` in `player.js`. The currently-playing album art is blurred (`blur(80px) saturate(1.8)`) and covers the full viewport at `z-index: -2`. A `body::before` gradient overlay sits at `z-index: -1` to keep text readable. `changelog.html` opts out of this layer entirely.

Key globals in `player.js`: `_ambientUseA` (bool toggle), `_ambientLastUrl` (dedup guard). Call `updateAmbient(artUrl)` whenever the track changes -- it is already wired into the SDK `player_state_changed` handler.

---

## Current development status

See `ROADMAP.md` for the full phase breakdown. Phases 1--3 are complete (v0.3): core feed,
all four signals, signal toggles, Last.fm username connect, and the like/skip feedback loop.
Phase 4 (daily refresh, save as playlist, heard-tracks persistence) is next.

---

## Deployment and git

- Vercel auto-deploys from `main`. Add each deployment URL as redirect URI in Spotify Dashboard.
- Hard refresh (Cmd+Shift+R) on mobile after deploys to pick up changes.
- Single `main` branch, direct pushes.

---

*Keep this file updated on every architectural change.*
