# CLAUDE.md -- signal.fm Development Guide

## What is signal.fm?

signal.fm is a passive music discovery web app. Where Scrobble Time Machine revisits the past and
SpotiMix blends the present, signal.fm explores the future -- a living feed of tracks the user
hasn't heard yet, driven by what they already love. Four signals feed the discovery engine:
artist similarity, track similarity, new releases from favourite artists, and daily fresh rotation.
The user scrolls, listens, likes, and the feed adapts in real time.

**Repo:** https://github.com/manuelmatheu/signal-fm
**Live:** https://signal-fm.vercel.app/ (or GitHub Pages TBD)
**Stack:** Vanilla JS, no framework, no build step. Spotify Web API + Web Playback SDK + Last.fm API.

---

## Architecture

### File structure

```
signal-fm/
├── index.html        -- HTML structure, feed container, player bar, signal toggles sidebar
├── CLAUDE.md         -- This file
├── README.md         -- User-facing docs
├── ROADMAP.md        -- Phased feature plan
├── css/
│   └── style.css     -- All styles: dark/light theme via CSS vars, feed cards, player bar
└── js/
    ├── config.js     -- API keys, OAuth scopes, all global state, constants
    ├── spotify.js    -- PKCE OAuth, token refresh, Spotify API helpers, SDK init, matchToSpotify
    ├── lastfm.js     -- Last.fm API calls: getSimilarArtists, getSimilarTracks, lfm()
    ├── seeds.js      -- Seed pool logic: build, expand, reweight, new releases, artist ID cache
    ├── player.js     -- SDK events, polling fallback, player bar UI, liked songs
    └── ui.js         -- Feed render, infinite scroll, signal toggles, badges, init()
```

### Script load order (strict -- no modules)

```html
<script src="https://sdk.scdn.co/spotify-player.js"></script>
<script src="js/config.js"></script>
<script src="js/spotify.js"></script>
<script src="js/lastfm.js"></script>
<script src="js/seeds.js"></script>
<script src="js/player.js"></script>
<script src="js/ui.js"></script>
```

All functions and variables are global. No modules, no build step, no bundler.

### Theme system

CSS variables in `:root` (light) and `[data-theme="dark"]` (dark). Theme toggle stored in
`localStorage('mixtape_theme')`. Inline IIFE in `<head>` applies theme before page renders.
Toggle icons: moon (dark) / sun (light). Same pattern as SpotiMix and Mixtape.

Key CSS vars: `--bg`, `--fg`, `--surface`, `--border`, `--border-s`, `--rust`, `--gold`,
`--sage`, `--card-shadow`, `--input-bg`, `--error-bg`.

---

## The four discovery signals

All four feed into a shared candidate pool, deduplicated by Spotify URI, then rendered as
track cards with a source badge. Signals can be toggled on/off via `signalWeights` in config.js.

### 1. Artist similarity (Last.fm)
- `artist.getSimilar` called for each artist in `seedPool.artists`
- Results weighted by match score and artist weight in seed pool
- Badge: "Similar to [seed artist]"

### 2. Track similarity (Last.fm)
- `track.getSimilar` called for seed tracks (from likes + top tracks of seed artists)
- Returns MusicBrainz track IDs -- must use name+artist fallback in matchToSpotify
- Badge: "Because you liked [track name]"

### 3. New releases (Spotify)
- `GET /artists/{id}/albums?include_groups=album,single&limit=10`
- Filtered to `NEW_RELEASE_WINDOW_DAYS` (180 days / 6 months)
- CAPPED to top 5 seed artists by weight to limit API calls (max ~50 calls on load)
- Fetch first 3 tracks per qualifying album via `GET /albums/{id}/tracks?limit=3`
- Skip `matchToSpotify()` -- already Spotify-native
- Badge: "New release"

### 4. Daily rotation
- On load, check `localStorage('signal_seeds_date')` -- if >24h old, rebuild seed pool
- Fresh `artist.getSimilar` batch replaces previous session's expansion
- Pre-generate next batch of 20 tracks in background while user listens

---

## Seed pool

The seed pool is the core of personalization. It's a weighted map of artists and tracks
that drives all four signals. It updates in real time as the user interacts.

```js
// config.js -- global seed state
let seedPool = {
  artists: {},   // { 'Radiohead': 1.0, 'Portishead': 0.8, 'Mogwai': 0.6 }
  tracks: {}     // { 'track_mbid_or_uri': 1.0 }
};

let signalWeights = {
  artistSimilar: true,
  trackSimilar:  true,
  newReleases:   true
};

const NEW_RELEASE_WINDOW_DAYS = 180;
const NEW_RELEASE_MAX_ARTISTS = 5;   // cap for new releases API calls
const FEED_BATCH_SIZE = 20;          // tracks per infinite scroll load
const ARTIST_ID_CACHE_TTL = 86400000; // 24h in ms

let heardUris = new Set();      // Spotify URIs already shown in feed
let sessionFeed = [];           // ordered array of resolved track objects
let isLoadingMore = false;      // infinite scroll guard
```

### Building the seed pool on load (`seeds.js`)

1. Spotify top artists (medium_term ~6 months) -> weight 1.0
2. Last.fm recent scrobbles (if username set) -> weight += 0.1 per play
3. Cache Spotify artist IDs immediately for top artists

### Reweighting on interaction

- `onLike(track)`: boost artist weight +0.3 (cap 1.5), add track as seed, expand
- `onSkip(track)`: deprioritize artist -0.2 (floor 0.1)

### Artist ID resolution cache (`seeds.js`)

Last.fm returns artist names; Spotify needs artist IDs. Cache the name->ID mapping
in localStorage with 24h TTL.

---

## Spotify integration

### OAuth (PKCE, no backend)

Same pattern as SpotiMix. `startAuth()` -> redirect -> `exchangeCode(code)` -> store tokens.

Scopes: `user-read-private`, `user-read-email`, `user-top-read`,
`user-read-recently-played`, `user-modify-playback-state`, `user-read-playback-state`,
`user-read-currently-playing`, `playlist-modify-public`, `playlist-modify-private`,
`streaming`, `user-library-modify`, `user-library-read`

Note: `user-top-read` is required for `GET /me/top/artists`.

### Web Playback SDK

Device named "signal.fm". `sdkReady` and `sdkDeviceId` globals.
`pollNowPlaying()` fallback for mobile.

### Key API patterns

- Playlist creation: always `/me/playlists`, NOT `/users/{id}/playlists`
- Liked songs: body required for PUT `/me/tracks`
- Top artists: `GET /me/top/artists?limit=10&time_range=medium_term`
- New releases: `GET /artists/{id}/albums?include_groups=album,single&limit=10`
- Album tracks: `GET /albums/{albumId}/tracks?limit=3`

---

## Last.fm integration

```js
const LFM_KEY = '177b9e8ee70fe2325bfff606cfdaee23'; // read-only, safe to expose
```

### Endpoints used

| Function | Method | Purpose |
|---|---|---|
| `getSimilarArtists(name)` | `artist.getSimilar` | Expand seed artists |
| `getSimilarTracks(name, artist)` | `track.getSimilar` | Expand seed tracks |
| `getUserRecentTracks(user)` | `user.getRecentTracks` | Optional Last.fm seeding |

### matchToSpotify()

Searches Spotify by track name + artist, prefers exact artist name match.
New release tracks skip this -- already Spotify-native.

---

## Feed rendering and infinite scroll (`ui.js`)

### Track card structure

Each card shows: album art, track name, artist, source badge, quick actions (add to queue, like).

Source badge values and colors:
- `artist_similar` -> "Similar to [artist]" (purple)
- `track_similar` -> "Because you liked [track]" (teal)
- `new_release` -> "New release" (coral)

### Infinite scroll via IntersectionObserver

Sentinel element observed with 200px rootMargin. `isLoadingMore` guard prevents
concurrent batch fetches.

---

## Player bar

Fixed bottom bar, hidden until first playback.
- Album art, track name/artist, heart, prev/play-pause/next, progress, volume
- `body.has-player` adds bottom padding
- `likedSet` tracks liked state
- `highlightNowPlaying(uri)` highlights card in feed

---

## localStorage conventions

| Key | Value | Purpose |
|---|---|---|
| `mixtape_theme` | `'dark'` / `'light'` | Theme (shared with other apps) |
| `spotify_token` | string | Access token |
| `spotify_refresh` | string | Refresh token |
| `signal_lfm_username` | string | Optional Last.fm username |
| `signal_artist_ids` | JSON object | Artist name -> Spotify ID cache (24h TTL) |
| `signal_seeds_date` | ISO timestamp | Last seed pool build time (for daily refresh) |

---

## Important gotchas

1. `user-top-read` scope is new -- not in SpotiMix
2. track.getSimilar returns mbid, not Spotify URI -- matchToSpotify() handles both
3. New releases cap: top 5 seed artists only
4. include_groups filter required for album endpoint
5. Artist ID resolution: check cache first, search as fallback
6. heardUris dedup is feed-level
7. Infinite scroll guard: isLoadingMore flag
8. SDK + mobile: pollNowPlaying() fallback at 5s interval
9. Pre-generate next batch in background
10. ASCII-only in HTML comments

---

## Deployment

- **Vercel** (production): auto-deploys from `main` branch
- `REDIRECT_URI = window.location.origin + window.location.pathname`
- Hard refresh needed on mobile after deploys

## Git workflow

- Single `main` branch, direct pushes
- Always `node --check js/file.js` before committing

---

*This file is for Claude Code / AI-assisted development. Keep it updated on every architectural change.*
