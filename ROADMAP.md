# ROADMAP.md -- signal.fm

> signal.fm is a passive music discovery feed. Five signals -- artist similarity, track similarity,
> new releases, deep cuts, and Last.fm picks -- feed a personalized stream of tracks the user
> hasn't heard yet. The feed adapts in real time as the user likes and skips.

---

## Phase 1 -- Core feed (MVP)

**Goal:** A working discovery feed that plays music. No personalization yet -- just seeds from
Spotify top artists and a single signal (artist similarity).

### Features
- [x] Spotify PKCE OAuth flow (`startAuth`, `exchangeCode`, `refreshAccessToken`)
- [x] `GET /me/top/artists?limit=10&time_range=medium_term` for initial seeds
- [x] `artist.getSimilar` via Last.fm -> `matchToSpotify()` -> 20 track cards on load
- [x] Feed card UI: album art, track name, artist, source badge, like + queue buttons
- [x] IntersectionObserver infinite scroll: load next 20 on sentinel visible
- [x] Web Playback SDK init (`initSDKPlayer`), device transfer, `spotifyPlay(uris)`
- [x] `pollNowPlaying()` fallback for mobile
- [x] Player bar: album art, track name/artist, prev/play-pause/next, progress, volume
- [x] `heardUris` Set for feed-level deduplication
- [x] Light/dark theme toggle (IIFE in `<head>`, `localStorage('mixtape_theme')`)
- [x] Basic liked songs: heart on player bar + track cards, `PUT/DELETE /me/tracks`
- [x] `node --check` on all JS files before first deploy
- [x] README with live URL and setup instructions

### Architecture locked in Phase 1
- 6-file structure (`config`, `spotify`, `lastfm`, `seeds`, `player`, `ui`)
- Global state only -- no ES modules
- `matchToSpotify()` with exact artist match preference and name+artist fallback
- `isLoadingMore` guard for infinite scroll

---

## Phase 2 -- All five signals

**Goal:** All discovery signals active, user can toggle them, Last.fm username optional.

### Features
- [x] `track.getSimilar` via Last.fm running in parallel with `artist.getSimilar`
      - Handle mbid-keyed results (no direct Spotify lookup -- use name+artist fallback)
      - Badge: "Because you liked [track]" (requires a liked seed track to activate)
- [x] New releases signal
      - `GET /search?q=artist:...&type=album` (NOT `/artists/{id}/albums` -- 403 in Dev Mode)
      - Filter to 180-day window (`NEW_RELEASE_WINDOW_DAYS`)
      - Cap to top 5 seed artists by weight (`NEW_RELEASE_MAX_ARTISTS`)
      - Fetch first 3 tracks per qualifying album
      - Skip `matchToSpotify()` -- already Spotify-native
      - Badge: "New release" with release date
- [x] Deep cuts signal: `artist.getTopTracks` positions 11-30 (skip well-known hits)
- [x] Signal toggle chips wired to `signalWeights`
      - Toggle change clears candidate buffer, re-fetches next batch
      - Already-rendered cards stay in feed
- [x] Artist ID resolution cache in `localStorage('signal_artist_ids')` with 24h TTL
      - Spotify top artists: cache immediately (ID known)
      - Last.fm-only seeds: `GET /search?type=artist&limit=1` on first use
- [x] Optional Last.fm username connect (read-only, no OAuth for seeding)
      - `user.getRecentTracks` merges scrobble data into `seedPool.artists`
      - Username stored in `localStorage('signal_lfm_username')`
- [x] `checkLikedTracks()` batch check on feed load (50 IDs/call max)
- [x] Source badges styled distinctly by signal type:
      - artist_similar: purple
      - track_similar: teal
      - new_release: coral
      - deep_cut: gold

---

## Phase 3 -- Feedback loop

**Goal:** The feed visibly shifts within the same session based on what the user likes and skips.

### Features
- [x] `onLike(track)` in `seeds.js`:
      - Boost `seedPool.artists[artist]` by +0.3 (cap at 1.5)
      - Add track to `seedPool.tracks` if mbid available
      - Trigger `expandFromTrack(track)` in background -- appends to candidate buffer
- [x] `onSkip(track)` in `seeds.js`:
      - Reduce `seedPool.artists[artist]` by -0.2 (floor at 0.1)
      - Don't remove -- track may resurface via different signal
- [x] Background pre-generation: while current batch plays, silently fetch + resolve
      next batch into a buffer so scroll never shows a loading spinner
- [x] Last.fm picks signal: personalized recommendations via Last.fm session OAuth
      - `startLfmAuth()` popup flow, `exchangeLfmToken()` for session key
      - `getLfmRecommendedTracks()` proxied through Vercel serverless function
- [x] Feed context panel ("About this feed") with seed list and active signals

---

## Phase 4 -- Daily refresh and persistence

**Goal:** The feed feels fresh every day without the user doing anything.

### Features
- [x] Daily seed rotation on load:
      - Check `localStorage('signal_seeds_date')`
      - If >24h old: silently rebuild `seedPool` from fresh Spotify + Last.fm pull
      - Update timestamp after rebuild
- [x] Save as Spotify playlist:
      - Button in header when connected
      - Creates private playlist named "signal.fm [date]"
      - Adds all `sessionFeed` URIs
      - Use `POST /me/playlists` (not `/users/{id}/playlists` -- 403 in Dev Mode)
- [x] Ambient background: album art bleeds into full-screen backdrop (blurred + saturated, crossfading)
- [x] Cinematic player bar: glow shadow when playing, pulse animation on play button
- [x] Changelog overlay

---

## Phase 5 -- Polish and discovery UX

**Goal:** Feel like a real product. Improve discoverability and delight.

### Features

- [ ] "Rabbit hole" mode: tap an artist name in the feed to temporarily flood
      the next batch with that artist's similar network
      - Auto-resets after 2 batches
- [ ] Keyboard shortcuts:
      - Space: play/pause
      - n/j: next track
      - p/k: previous track
      - l/h: like current track
      - ?: show shortcuts modal
- [ ] Persist `heardUris` to `localStorage('signal_heard')` with 30-day expiry
      - Prevents same tracks resurfacing in future sessions
      - Cap at 2000 entries -- drop oldest on overflow
- [ ] Mobile layout: single column, larger tap targets
- [ ] Empty state: if no Spotify top artists yet (new account), show onboarding prompt
      to pick 3-5 seed artists manually

---

## Known constraints and non-goals

- **Vercel required for full functionality** -- the Last.fm picks signal uses a serverless proxy
  (`api/lfm-station.js`) to bypass CORS. Static-only hosts will have all other signals but not picks.
- **No multi-service input** -- Spotify + Last.fm only. Apple Music, Bandcamp etc. deferred
  indefinitely due to access restrictions and added complexity.
- **No scrobbling to Last.fm** -- would require Last.fm OAuth for writes. Out of scope.
- **`artist.getSimilar` quality** -- Last.fm similarity data is good for mainstream artists,
  thinner for very niche or new artists. Accept this gracefully: if getSimilar returns <3
  results, fall back to `tag.getTopTracks` for the artist's top tag.
- **Spotify Development Mode** -- app is capped at 25 users until Spotify quota extension
  approved. Submit for extension once core features are stable.
- **Last.fm radio API removed** -- `radio.tune`, `radio.getPlaylist`, and `user.getRecommendedTracks`
  all return error 3 (method removed). Picks signal uses the internal web player station endpoint
  instead: `https://www.last.fm/player/station/user/{username}/recommended`.

---

## Version history

### v0.1
- Core feed with artist similarity signal
- Web Playback SDK + polling fallback
- Player bar, liked songs, infinite scroll
- Light/dark theme

### v0.2
- All five signals active (artist similarity, track similarity, new releases, deep cuts, Last.fm picks)
- Signal toggle chips
- Last.fm username connect + session OAuth
- Artist ID cache
- 2nd-hop artist expansion

### v0.3
- Real-time feedback loop (like/skip reweights seed pool)
- Background pre-generation (candidate buffer)
- Feed context panel ("About this feed")

### v0.4
- Ambient crossfading background layer (album art blurred + saturated)
- DM Serif Display typography
- Cinematic player bar (glow, pulse animation)
- Changelog overlay

### v0.5 (2026-04-16)
- **Last.fm picks fixed** -- all official Last.fm radio/recommendation APIs were removed (error 3);
  rebuilt on the internal web player station endpoint via Vercel serverless proxy (`api/lfm-station.js`)
- **UI polish** -- removed banned side-stripe CSS pattern from now-playing indicator; cleaned ~80 lines
  of dead CSS from removed sidebar; redesigned welcome and generate screens
- **Layout** -- feed column narrowed to 820px for comfortable reading width; spatial rhythm established
  (signal filters and feed context now have consistent breathing room between sections)
