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

```js
async function buildSeedPool() {
  // 1. Spotify top artists (medium_term = ~6 months)
  const spotifyTop = await spGet('/me/top/artists?limit=10&time_range=medium_term');
  for (const artist of spotifyTop.items) {
    seedPool.artists[artist.name] = 1.0;
    // cache Spotify artist ID immediately -- skip resolveSpotifyArtistIds() for these
    cacheArtistId(artist.name, artist.id);
  }

  // 2. Last.fm recent scrobbles (if username set)
  const lfmUser = localStorage.getItem('signal_lfm_username');
  if (lfmUser) {
    const recent = await lfm({ method: 'user.getRecentTracks', user: lfmUser, limit: 50 });
    for (const track of recent.recenttracks.track) {
      const name = track.artist['#text'];
      if (name) seedPool.artists[name] = Math.min(1.0, (seedPool.artists[name] || 0) + 0.1);
    }
  }
}
```

### Reweighting on interaction

```js
function onLike(track) {
  // boost artist
  seedPool.artists[track.artist] = Math.min(1.5, (seedPool.artists[track.artist] || 0.5) + 0.3);
  // add track as seed for track.getSimilar
  if (track.mbid) seedPool.tracks[track.mbid] = 1.0;
  // expand feed from this track in background
  expandFromTrack(track);
}

function onSkip(track) {
  // gently deprioritize -- don't remove, might resurface
  if (seedPool.artists[track.artist]) {
    seedPool.artists[track.artist] = Math.max(0.1, seedPool.artists[track.artist] - 0.2);
  }
}
```

### Artist ID resolution cache (`seeds.js`)

Last.fm returns artist names; Spotify needs artist IDs. Cache the name->ID mapping.

```js
function cacheArtistId(name, id) {
  const cache = JSON.parse(localStorage.getItem('signal_artist_ids') || '{}');
  cache[name] = { id, ts: Date.now() };
  localStorage.setItem('signal_artist_ids', JSON.stringify(cache));
}

async function resolveArtistId(name) {
  const cache = JSON.parse(localStorage.getItem('signal_artist_ids') || '{}');
  const entry = cache[name];
  if (entry && Date.now() - entry.ts < ARTIST_ID_CACHE_TTL) return entry.id;
  // fetch from Spotify search
  const data = await spGet('/search?q=' + encodeURIComponent(name) + '&type=artist&limit=1');
  const artist = data.artists?.items?.[0];
  if (!artist) return null;
  cacheArtistId(name, artist.id);
  return artist.id;
}
```

---

## Spotify integration

### OAuth (PKCE, no backend)

Same pattern as SpotiMix. `startAuth()` -> redirect -> `exchangeCode(code)` -> store tokens.

```js
// config.js
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = [
  'user-read-private', 'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-modify-playback-state', 'user-read-playback-state', 'user-read-currently-playing',
  'playlist-modify-public', 'playlist-modify-private',
  'streaming', 'user-library-modify', 'user-library-read'
].join(' ');
```

Note: `user-top-read` is new here (not in SpotiMix) -- required for `GET /me/top/artists`.
Any scope change requires users to disconnect and reconnect.

### Web Playback SDK

Same init pattern as SpotiMix. Device named "signal.fm". `sdkReady` and `sdkDeviceId` globals.
`pollNowPlaying()` fallback for mobile. `player_state_changed` drives player bar updates.

### Key API patterns

```js
// Playlist creation -- always /me/playlists, NOT /users/{id}/playlists (403 in Dev Mode)
await spPost('/me/playlists', { name: 'signal.fm discovery', public: false });

// Liked songs -- body required
await spPut('/me/tracks', { ids: [trackId] });

// Top artists for seeding
await spGet('/me/top/artists?limit=10&time_range=medium_term');

// New releases per artist
await spGet(`/artists/${id}/albums?include_groups=album,single&limit=10&market=from_token`);

// Album tracks
await spGet(`/albums/${albumId}/tracks?limit=3`);
```

---

## Last.fm integration

```js
// config.js
const LFM_KEY = '177b9e8ee70fe2325bfff606cfdaee23'; // read-only, safe to expose
```

### Endpoints used

| Function | Method | Purpose |
|---|---|---|
| `getSimilarArtists(name)` | `artist.getSimilar` | Expand seed artists |
| `getSimilarTracks(name, artist)` | `track.getSimilar` | Expand seed tracks |
| `getUserRecentTracks(user)` | `user.getRecentTracks` | Optional Last.fm seeding |

### matchToSpotify() -- handles both Last.fm and Spotify-native tracks

```js
async function matchToSpotify(lfmTrack) {
  // track.getSimilar returns mbid -- prefer mbid search if available
  const q = `track:${lfmTrack.name} artist:${lfmTrack.artist}`;
  const data = await spGet('/search?q=' + encodeURIComponent(q) + '&type=track&limit=5');
  const items = data.tracks?.items || [];
  // prefer exact artist name match
  const exact = items.find(t =>
    t.artists[0].name.toLowerCase() === lfmTrack.artist.toLowerCase()
  );
  const track = exact || items[0];
  if (!track) return null;
  return {
    uri: track.uri,
    id: track.id,
    name: track.name,
    artist: track.artists[0].name,
    artistId: track.artists[0].id,
    duration: track.duration_ms,
    albumArt: track.album.images[1]?.url,
    mbid: lfmTrack.mbid || null,
    _source: lfmTrack._source || 'artist_similar'
  };
}
```

New release tracks skip `matchToSpotify()` -- they're already resolved. Build their track
object directly from the Spotify album/track response, setting `_source: 'new_release'`.

---

## Feed rendering and infinite scroll (`ui.js`)

### Track card structure

Each card shows: album art, track name, artist, source badge, quick actions (add to queue, like).

Source badge values and colors:
- `artist_similar` -> "Similar to [artist]" (purple)
- `track_similar` -> "Because you liked [track]" (teal)
- `new_release` -> "New release" (coral)

### Infinite scroll via IntersectionObserver

```js
function initInfiniteScroll() {
  const sentinel = document.getElementById('feed-sentinel');
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !isLoadingMore) {
      isLoadingMore = true;
      loadNextBatch().then(() => { isLoadingMore = false; });
    }
  }, { rootMargin: '200px' });
  observer.observe(sentinel);
}

async function loadNextBatch() {
  const candidates = await fetchCandidates(); // calls all active signals
  const resolved = [];
  for (const c of candidates) {
    if (heardUris.has(c.uri)) continue;
    const track = c._source === 'new_release' ? c : await matchToSpotify(c);
    if (!track) continue;
    if (heardUris.has(track.uri)) continue;
    heardUris.add(track.uri);
    resolved.push(track);
    if (resolved.length >= FEED_BATCH_SIZE) break;
  }
  sessionFeed.push(...resolved);
  renderTracks(resolved);
}
```

### Signal toggle sidebar

Three toggles wired to `signalWeights`. On toggle change, clear current candidates and
re-fetch next batch. Don't re-render already-shown cards -- only affects what loads next.

```js
document.getElementById('toggle-artist-similar').addEventListener('change', e => {
  signalWeights.artistSimilar = e.target.checked;
});
// same for trackSimilar, newReleases
```

---

## Player bar

Fixed bottom bar, hidden until first playback. Same pattern as SpotiMix.
- Album art, track name/artist, heart, prev/play-pause/next, progress, volume
- `body.has-player` adds bottom padding
- `likedSet` (Set of track IDs) tracks liked state
- `highlightNowPlaying(uri)` finds card in feed by URI and highlights it
- `updatePlayerBarHeart()` called on every track change

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

1. **`user-top-read` scope is new** -- not in SpotiMix. Users connecting Spotify for the
   first time will get it automatically. Existing tokens won't have it -- must re-auth.

2. **track.getSimilar returns mbid, not Spotify URI** -- `matchToSpotify()` must handle
   both the mbid case (no direct Spotify lookup) and the name+artist fallback.

3. **New releases cap** -- only call album endpoint for top `NEW_RELEASE_MAX_ARTISTS` (5)
   seed artists by weight. Otherwise 10+ seed artists x 10 albums = 100+ API calls on load.

4. **include_groups filter** -- `GET /artists/{id}/albums` must specify
   `include_groups=album,single` to exclude `appears_on` and `compilation`. Without this,
   a popular artist returns dozens of low-quality entries.

5. **Artist ID resolution** -- Last.fm returns names, Spotify needs IDs. Always check
   localStorage cache first. Artists pulled from Spotify top list can be cached immediately
   (ID is already known). Last.fm-only seeds need a search call.

6. **heardUris dedup is feed-level** -- check before rendering, not just before playback.
   A track that appears as both an artist_similar result and a new_release must only render
   once in the feed.

7. **Infinite scroll guard** -- `isLoadingMore` flag prevents concurrent batch fetches
   when user scrolls fast. Always reset to `false` after batch completes (including on error).

8. **SDK + mobile** -- SDK unavailable on some mobile browsers. `pollNowPlaying()` fallback
   at 5s interval. Player bar updates are less smooth but functional.

9. **Pre-generate next batch** -- while the current batch plays, fetch the next batch in
   the background and hold it in a buffer. Avoids visible loading spinner on scroll.

10. **ASCII-only in HTML comments** -- Unicode box-drawing or emoji in comments breaks
    some tools. Never use them.

---

## Quick reference: key functions

| Function | File | Purpose |
|---|---|---|
| `buildSeedPool()` | seeds.js | Build initial weighted artist/track map |
| `expandFromArtist(name)` | seeds.js | artist.getSimilar -> add to candidates |
| `expandFromTrack(track)` | seeds.js | track.getSimilar -> add to candidates |
| `getNewReleasesForSeeds()` | seeds.js | Spotify album fetch for top-5 seed artists |
| `resolveArtistId(name)` | seeds.js | Last.fm name -> Spotify ID (with cache) |
| `onLike(track)` | seeds.js | Boost seed weight + trigger expansion |
| `onSkip(track)` | seeds.js | Gently deprioritize artist in seed pool |
| `matchToSpotify(lfmTrack)` | spotify.js | Last.fm track -> Spotify URI |
| `loadNextBatch()` | ui.js | Fetch + resolve + render next 20 tracks |
| `initInfiniteScroll()` | ui.js | Wire IntersectionObserver to sentinel |
| `renderTracks(tracks)` | ui.js | Append track cards to feed DOM |
| `playFromTrack(uri)` | player.js | Start playback from URI |
| `spotifyPlay(uris)` | spotify.js | Play URIs via SDK or remote |
| `pollNowPlaying()` | player.js | Remote fallback: poll current track |
| `onSDKStateChange(state)` | player.js | SDK: handle state changes |
| `savePlaylist()` | spotify.js | Save feed tracks to Spotify playlist |
| `checkLikedTracks()` | ui.js | Batch-check liked status (50 IDs/call) |
| `toggleLikeTrack(uri)` | ui.js | Like/unlike via PUT/DELETE /me/tracks |

---

## Deployment

- **Vercel** (production): auto-deploys from `main` branch
- `REDIRECT_URI = window.location.origin + window.location.pathname` -- adapts to any domain
- Add each deployment URL as redirect URI in Spotify Developer Dashboard
- Hard refresh (Cmd+Shift+R) needed on mobile after deploys

## Git workflow

- Single `main` branch, direct pushes
- `git config user.email "claude@anthropic.com"` / `user.name "Claude"`
- Remote: `https://x-access-token:{PAT}@github.com/manuelmatheu/signal-fm.git`
- Always `node --check js/file.js` before committing
- Never push without syntax check passing

---

*This file is for Claude Code / AI-assisted development. Keep it updated on every architectural change.*
