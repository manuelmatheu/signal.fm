/* signal.fm -- seeds.js
   Seed pool logic: build, expand, reweight, new releases, artist ID cache */

// ---- Artist ID cache ----

function cacheArtistId(name, id) {
  var cache = JSON.parse(localStorage.getItem('signal_artist_ids') || '{}');
  cache[name] = { id: id, ts: Date.now() };
  localStorage.setItem('signal_artist_ids', JSON.stringify(cache));
}

function getCachedArtistId(name) {
  var cache = JSON.parse(localStorage.getItem('signal_artist_ids') || '{}');
  var entry = cache[name];
  if (entry && Date.now() - entry.ts < ARTIST_ID_CACHE_TTL) return entry.id;
  return null;
}

async function resolveArtistId(name) {
  var cached = getCachedArtistId(name);
  if (cached) return cached;

  var data = await spGet('/search?q=' + encodeURIComponent(name) + '&type=artist&limit=1');
  if (!data || !data.artists || !data.artists.items || !data.artists.items[0]) return null;
  var artist = data.artists.items[0];
  cacheArtistId(name, artist.id);
  return artist.id;
}

// ---- Resolve Spotify IDs for all seed artists ----

async function resolveSpotifyArtistIds() {
  var names = Object.keys(seedPool.artists);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (!getCachedArtistId(name)) {
      await resolveArtistId(name);
    }
  }
}

// ---- Build seed pool ----

async function buildSeedPool() {
  seedPool.artists = {};
  seedPool.tracks = {};

  // 1. Spotify top artists (medium_term ~6 months)
  var spotifyTop = await spGet('/me/top/artists?limit=10&time_range=medium_term');
  if (spotifyTop && spotifyTop.items) {
    for (var i = 0; i < spotifyTop.items.length; i++) {
      var artist = spotifyTop.items[i];
      seedPool.artists[artist.name] = 1.0;
      cacheArtistId(artist.name, artist.id);
    }
  }

  // 2. Last.fm recent scrobbles (if username set)
  var lfmUser = localStorage.getItem('signal_lfm_username');
  if (lfmUser) {
    var recent = await getUserRecentTracks(lfmUser, 50);
    for (var j = 0; j < recent.length; j++) {
      var track = recent[j];
      var name = track.artist ? (track.artist['#text'] || track.artist.name || '') : '';
      if (name) {
        seedPool.artists[name] = Math.min(1.0, (seedPool.artists[name] || 0) + 0.1);
      }
    }
  }

  // Store build date for daily rotation
  localStorage.setItem('signal_seeds_date', new Date().toISOString());

  // Resolve any unresolved artist IDs
  await resolveSpotifyArtistIds();
}

// ---- Check daily rotation ----

function needsSeedRebuild() {
  var dateStr = localStorage.getItem('signal_seeds_date');
  if (!dateStr) return true;
  var diff = Date.now() - new Date(dateStr).getTime();
  return diff > 86400000; // 24h
}

// ---- Expand from artist (artist.getSimilar) ----

async function expandFromArtist(seedArtistName) {
  var similar = await getSimilarArtists(seedArtistName, 15);
  var trackCandidates = [];
  var topArtists = similar.slice(0, 5);
  var market = userMarket || 'US';

  for (var j = 0; j < topArtists.length; j++) {
    var name = topArtists[j].name;
    // Use search instead of /artists/{id}/top-tracks (avoids 403 catalog restriction)
    var data = await spGet('/search?q=artist:' + encodeURIComponent(name) + '&type=track&limit=3&market=' + market);
    if (!data || !data.tracks || !data.tracks.items) continue;

    for (var k = 0; k < data.tracks.items.length; k++) {
      var t = data.tracks.items[k];
      // Only tracks where the primary artist matches
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

// ---- Expand from track (track.getSimilar) ----

async function expandFromTrack(track) {
  var similar = await getSimilarTracks(track.name, track.artist, 15);
  var candidates = [];

  for (var i = 0; i < similar.length; i++) {
    var s = similar[i];
    candidates.push({
      name: s.name,
      artist: s.artist,
      mbid: s.mbid || null,
      _source: 'track_similar',
      _sourceDetail: track.name
    });
  }

  return candidates;
}

// ---- New releases for top seed artists ----

async function getNewReleasesForSeeds() {
  var artistEntries = Object.entries(seedPool.artists);
  artistEntries.sort(function(a, b) { return b[1] - a[1]; });
  var topArtists = artistEntries.slice(0, NEW_RELEASE_MAX_ARTISTS);

  var cutoff = Date.now() - (NEW_RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  var candidates = [];
  var market = userMarket || 'US';

  for (var i = 0; i < topArtists.length; i++) {
    var artistName = topArtists[i][0];
    // Use search instead of /artists/{id}/albums (avoids 403 catalog restriction)
    var data = await spGet('/search?q=artist:' + encodeURIComponent(artistName) + '&type=album&limit=10&market=' + market);
    if (!data || !data.albums || !data.albums.items) continue;

    for (var j = 0; j < data.albums.items.length; j++) {
      var album = data.albums.items[j];
      // Verify primary artist matches (search can return loose results)
      var artistMatch = album.artists.some(function(a) {
        return a.name.toLowerCase() === artistName.toLowerCase();
      });
      if (!artistMatch) continue;

      var releaseDate = new Date(album.release_date).getTime();
      if (releaseDate < cutoff) continue;

      // Fetch first 3 tracks from qualifying album
      var tracks = await spGet('/albums/' + album.id + '/tracks?limit=3');
      if (!tracks || !tracks.items) continue;

      for (var k = 0; k < tracks.items.length; k++) {
        var t = tracks.items[k];
        candidates.push({
          uri: t.uri,
          id: t.id,
          name: t.name,
          artist: t.artists[0].name,
          artistId: t.artists[0].id,
          duration: t.duration_ms,
          albumArt: album.images[1] ? album.images[1].url : (album.images[0] ? album.images[0].url : ''),
          mbid: null,
          _source: 'new_release',
          _sourceDetail: artistName,
          _resolved: true
        });
      }
    }
  }

  return candidates;
}

// ---- Fetch candidates from all active signals ----

async function fetchCandidates() {
  var all = [];
  var artistNames = Object.keys(seedPool.artists);

  // Shuffle seed artists for variety
  for (var i = artistNames.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = artistNames[i];
    artistNames[i] = artistNames[j];
    artistNames[j] = tmp;
  }

  var promises = [];

  // Artist similarity
  if (signalWeights.artistSimilar && artistNames.length > 0) {
    // Pick 3 random seed artists per batch
    var pick = artistNames.slice(0, 3);
    for (var a = 0; a < pick.length; a++) {
      promises.push(expandFromArtist(pick[a]));
    }
  }

  // Track similarity
  if (signalWeights.trackSimilar) {
    var trackKeys = Object.keys(seedPool.tracks);
    if (trackKeys.length > 0) {
      // Use most recent liked tracks as seeds
      var trackSeeds = trackKeys.slice(-3);
      for (var t = 0; t < trackSeeds.length; t++) {
        var key = trackSeeds[t];
        // key could be mbid or "name|artist"
        var parts = key.split('|');
        if (parts.length === 2) {
          promises.push(expandFromTrack({ name: parts[0], artist: parts[1] }));
        }
      }
    } else if (artistNames.length > 0) {
      // Fallback: search for a track by a random seed artist to seed track.getSimilar
      var randomArtist = artistNames[Math.floor(Math.random() * artistNames.length)];
      var rData = await spGet('/search?q=artist:' + encodeURIComponent(randomArtist) + '&type=track&limit=1&market=' + (userMarket || 'US'));
      if (rData && rData.tracks && rData.tracks.items && rData.tracks.items.length > 0) {
        var seedTrack = rData.tracks.items[0];
        promises.push(expandFromTrack({ name: seedTrack.name, artist: seedTrack.artists[0].name }));
      }
    }
  }

  // New releases
  if (signalWeights.newReleases) {
    promises.push(getNewReleasesForSeeds());
  }

  var results = await Promise.all(promises);
  for (var r = 0; r < results.length; r++) {
    if (results[r]) all = all.concat(results[r]);
  }

  // Shuffle all candidates
  for (var s = all.length - 1; s > 0; s--) {
    var sj = Math.floor(Math.random() * (s + 1));
    var stmp = all[s];
    all[s] = all[sj];
    all[sj] = stmp;
  }

  return all;
}

// ---- Reweighting on interaction ----

function onLike(track) {
  // Boost artist weight
  seedPool.artists[track.artist] = Math.min(1.5, (seedPool.artists[track.artist] || 0.5) + 0.3);
  // Add track as seed for track.getSimilar
  var trackKey = track.name + '|' + track.artist;
  seedPool.tracks[trackKey] = 1.0;
  // Cache artist ID if we have it
  if (track.artistId) cacheArtistId(track.artist, track.artistId);
}

function onSkip(track) {
  if (seedPool.artists[track.artist]) {
    seedPool.artists[track.artist] = Math.max(0.1, seedPool.artists[track.artist] - 0.2);
  }
}
