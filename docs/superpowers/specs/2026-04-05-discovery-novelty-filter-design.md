# Discovery Novelty Filter — Design Spec
_2026-04-05_

## Problem

The feed surfaces tracks from artists the user already knows in two ways:

1. **Seed artists leak into recommendations** — candidates whose artist is already in `seedPool.artists` appear in all signals (except `new_release`, which is intentional).
2. **Similarity graph is too shallow** — `expandFromArtist` only goes one hop deep, returning well-known adjacent artists rather than genuinely unfamiliar ones.
3. **Same artist appears multiple times or consecutively** — URI deduplication (`heardUris`) exists but there is no artist-level dedup, so an artist can dominate the feed.

## Goals

- Filter known seed artists out of discovery signals (keep them in `new_release`)
- Surface 2nd-hop similar artists to push discovery further from the user's known taste graph
- Prevent any artist from appearing more than once per session feed

## Design

### 1. Known-artist filter (`isKnownArtist`)

Add a helper in `seeds.js`:

```js
function isKnownArtist(name) {
  return !!seedPool.artists[name.toLowerCase
    ? name // case-insensitive check via normalisation below
    : name];
}
```

Normalise both sides to lowercase for the comparison.

Apply as a post-processing step at the end of `fetchCandidates()`, before returning candidates:

- Filter out any candidate where `isKnownArtist(track.artist)` is true
- **Exempt** candidates with `_source === 'new_release'` — those are intentionally about known artists' new music

### 2. Artist-level deduplication (`heardArtists`)

Add a new global Set in `config.js`:

```js
var heardArtists = new Set(); // artist names already shown this session
```

Populate it in `renderTracks()` in `ui.js`, alongside the existing `heardUris` population.

Filter candidates against it in `fetchCandidates()` — skip any candidate whose `track.artist` (lowercased) is already in `heardArtists`. This applies to **all signals including `new_release`** (unlike the known-artist filter) to prevent the same artist appearing twice even across different signals.

`heardArtists` is session-only — cleared on page reload, no persistence.

### 3. 2nd-hop expansion in `expandFromArtist`

Current behaviour: get top 15 similar artists from Last.fm, take the top 3, fetch their tracks.

New behaviour:

1. Get top 15 similar artists from Last.fm (1st-hop list)
2. Filter out any artist already in `seedPool.artists` from this list
3. Take the **1st artist** from the filtered 1st-hop list and call `getSimilarArtists` on them (2nd-hop call)
4. Filter out seed pool artists from the 2nd-hop list as well
5. Build a mixed pool: **2 artists from 1st-hop + 2 artists from 2nd-hop**
6. Fetch tracks from this pool using the existing Spotify search approach

**API cost:** one additional Last.fm `artist.getSimilar` call per `expandFromArtist` invocation. Currently called for 2 seed artists per batch = 2 extra Last.fm calls per batch. Well within rate limits.

## Files changed

| File | Change |
|---|---|
| `js/config.js` | Add `var heardArtists = new Set()` |
| `js/seeds.js` | Add `isKnownArtist()`, update `expandFromArtist()` for 2nd-hop, add known-artist + artist-dedup filters in `fetchCandidates()` |
| `js/ui.js` | Populate `heardArtists` in `renderTracks()` |

## Out of scope

- Genre-based broadening (Option C) — deferred
- Persistence of `heardArtists` across sessions
- Changes to `new_release` signal logic
