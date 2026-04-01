# ROADMAP.md -- signal.fm

> signal.fm is a passive music discovery feed. Four signals -- artist similarity, track similarity,
> new releases, and daily rotation -- feed a personalized stream of tracks the user hasn't heard
> yet. The feed adapts in real time as the user likes and skips.

---

## Phase 1 -- Core feed (MVP)

**Goal:** A working discovery feed that plays music. No personalization yet -- just seeds from
Spotify top artists and a single signal (artist similarity).

### Features
- [ ] Spotify PKCE OAuth flow (`startAuth`, `exchangeCode`, `refreshAccessToken`)
- [ ] `GET /me/top/artists?limit=10&time_range=medium_term` for initial seeds
- [ ] `artist.getSimilar` via Last.fm -> `matchToSpotify()` -> 20 track cards on load
- [ ] Feed card UI: album art, track name, artist, source badge, like + queue buttons
- [ ] IntersectionObserver infinite scroll: load next 20 on sentinel visible
- [ ] Web Playback SDK init (`initSDKPlayer`), device transfer, `spotifyPlay(uris)`
- [ ] `pollNowPlaying()` fallback for mobile
- [ ] Player bar: album art, track name/artist, prev/play-pause/next, progress, volume
- [ ] `heardUris` Set for feed-level deduplication
- [ ] Light/dark theme toggle (IIFE in `<head>`, `localStorage('mixtape_theme')`)
- [ ] Basic liked songs: heart on player bar + track cards, `PUT/DELETE /me/tracks`
- [ ] `node --check` on all JS files before first deploy
- [ ] README with live URL and setup instructions

### Architecture locked in Phase 1
- 6-file structure (`config`, `spotify`, `lastfm`, `seeds`, `player`, `ui`)
- Global state only -- no ES modules
- `matchToSpotify()` with exact artist match preference and name+artist fallback
- `isLoadingMore` guard for infinite scroll

---

## Phase 2 -- All four signals

**Goal:** All discovery signals active, user can toggle them, Last.fm username optional.

### Features
- [ ] `track.getSimilar` via Last.fm running in parallel with `artist.getSimilar`
      - Handle mbid-keyed results (no direct Spotify lookup -- use name+artist fallback)
      - Badge: "Because you liked [track]" (requires a liked seed track to activate)
- [ ] New releases signal
      - `GET /artists/{id}/albums?include_groups=album,single&limit=10`
      - Filter to 180-day window (`NEW_RELEASE_WINDOW_DAYS`)
      - Cap to top 5 seed artists by weight (`NEW_RELEASE_MAX_ARTISTS`)
      - Fetch first 3 tracks per qualifying album
      - Skip `matchToSpotify()` -- already Spotify-native
      - Badge: "New release" with release date
- [ ] Signal toggle sidebar: three checkboxes wired to `signalWeights`
      - Toggle change clears candidate buffer, re-fetches next batch
      - Already-rendered cards stay in feed
- [ ] Artist ID resolution cache in `localStorage('signal_artist_ids')` with 24h TTL
      - Spotify top artists: cache immediately (ID known)
      - Last.fm-only seeds: `GET /search?type=artist&limit=1` on first use
- [ ] Optional Last.fm username connect (read-only, no OAuth)
      - `user.getRecentTracks` merges scrobble data into `seedPool.artists`
      - Username stored in `localStorage('signal_lfm_username')`
- [ ] `checkLikedTracks()` batch check on feed load (50 IDs/call max)
- [ ] Source badges styled distinctly by signal type:
      - artist_similar: purple
      - track_similar: teal
      - new_release: coral

---

## Phase 3 -- Feedback loop

**Goal:** The feed visibly shifts within the same session based on what the user likes and skips.

### Features
- [ ] `onLike(track)` in `seeds.js`:
      - Boost `seedPool.artists[artist]` by +0.3 (cap at 1.5)
      - Add track to `seedPool.tracks` if mbid available
      - Trigger `expandFromTrack(track)` in background -- appends to candidate buffer
      - Badge updates to "Because you liked X" on subsequent similar tracks
- [ ] `onSkip(track)` in `seeds.js`:
      - Reduce `seedPool.artists[artist]` by -0.2 (floor at 0.1)
      - Don't remove -- track may resurface via different signal
- [ ] Skip detection: auto-call `onSkip` if user skips via next button before 30s played
- [ ] Background pre-generation: while current batch plays, silently fetch + resolve
      next batch into a buffer so scroll never shows a loading spinner
- [ ] "Why this track" tooltip on hover/tap showing signal and seed source
      - e.g. "Found via artist.getSimilar from Radiohead (your #2 artist)"

---

## Phase 4 -- Daily refresh and persistence

**Goal:** The feed feels fresh every day without the user doing anything.

### Features
- [ ] Daily seed rotation on load:
      - Check `localStorage('signal_seeds_date')`
      - If >24h old: silently rebuild `seedPool` from fresh Spotify + Last.fm pull
      - Update timestamp after rebuild
- [ ] Save as Spotify playlist:
      - Button in sidebar or player bar
      - Creates private playlist named "signal.fm [date]"
      - Adds all `sessionFeed` URIs
      - Use `POST /me/playlists` (not `/users/{id}/playlists` -- 403 in Dev Mode)
- [ ] Persist `heardUris` to `localStorage('signal_heard')` with 30-day expiry
      - Prevents same tracks resurfacing in future sessions
      - Cap at 2000 entries -- drop oldest on overflow
- [ ] Session stats: tracks heard, liked, skipped (shown in sidebar, not persisted)

---

## Phase 5 -- Polish and discovery UX

**Goal:** Feel like a real product. Improve discoverability and delight.

### Features
- [ ] Genre/tag filter chips in sidebar
      - Pull from `artist.getTopTags` for seed artists
      - Filter candidate pool to only tracks tagged with selected genres
- [ ] "Rabbit hole" mode: tap an artist name in the feed to temporarily flood
      the next batch with that artist's similar network
      - Auto-resets after 2 batches
- [ ] Keyboard shortcuts (same pattern as SpotiMix):
      - Space: play/pause
      - n/j: next track
      - p/k: previous track
      - l/h: like current track
      - ?: show shortcuts modal
- [ ] Changelog modal (same pattern as SpotiMix)
- [ ] Mobile layout: single column, larger tap targets, bottom sheet for signal toggles
- [ ] Empty state: if no Spotify top artists yet (new account), show onboarding prompt
      to pick 3-5 seed artists manually

---

## Known constraints and non-goals

- **No backend** -- everything is client-side. Spotify PKCE handles auth without a server.
- **No multi-service input** -- Spotify + Last.fm only. Apple Music, Bandcamp etc. deferred
  indefinitely due to access restrictions and added complexity.
- **No scrobbling to Last.fm** -- would require Last.fm OAuth (separate flow). Out of scope.
- **`artist.getSimilar` quality** -- Last.fm similarity data is good for mainstream artists,
  thinner for very niche or new artists. Accept this gracefully: if getSimilar returns <3
  results, fall back to `tag.getTopTracks` for the artist's top tag.
- **Spotify Development Mode** -- app is capped at 25 users until Spotify quota extension
  approved. Submit for extension once core features are stable.

---

## Version history

### v0.1 (Phase 1 complete)
- Core feed with artist similarity signal
- Web Playback SDK + polling fallback
- Player bar, liked songs, infinite scroll
- Light/dark theme

### v0.2 (Phase 2 complete)
- All four signals active
- Signal toggle sidebar
- Last.fm username connect
- Artist ID cache

### v0.3 (Phase 3 complete)
- Real-time feedback loop (like/skip reweights seed pool)
- Background pre-generation
- "Why this track" tooltip

### v0.4 (Phase 4 complete)
- Daily refresh
- Save as Spotify playlist
- Heard tracks persistence

### v1.0 (Phase 5 complete)
- Genre filter chips
- Rabbit hole mode
- Keyboard shortcuts
- Mobile layout polish
