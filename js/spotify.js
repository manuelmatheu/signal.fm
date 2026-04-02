/* signal.fm -- spotify.js
   PKCE OAuth, token refresh, Spotify API helpers, SDK init, matchToSpotify */

// ---- PKCE helpers ----

function generateRandomString(length) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  var arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  var result = '';
  for (var i = 0; i < length; i++) result += chars[arr[i] % chars.length];
  return result;
}

async function sha256(plain) {
  var enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(plain));
}

function base64urlencode(buf) {
  var bytes = new Uint8Array(buf);
  var str = '';
  for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---- OAuth flow ----

async function startAuth() {
  var verifier = generateRandomString(64);
  sessionStorage.setItem('pkce_verifier', verifier);
  var hashed = await sha256(verifier);
  var challenge = base64urlencode(hashed);

  var params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

async function exchangeCode(code) {
  var verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) { console.error('No PKCE verifier found'); return false; }

  var body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  var resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  if (!resp.ok) { console.error('Token exchange failed', resp.status); return false; }

  var data = await resp.json();
  storeTokens(data);
  sessionStorage.removeItem('pkce_verifier');
  return true;
}

async function refreshAccessToken() {
  if (!refreshToken) return false;
  var body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  var resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  if (!resp.ok) { console.error('Token refresh failed'); disconnectSpotify(); return false; }

  var data = await resp.json();
  storeTokens(data);
  return true;
}

function storeTokens(data) {
  accessToken = data.access_token;
  if (data.refresh_token) refreshToken = data.refresh_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  localStorage.setItem('spotify_token', accessToken);
  if (data.refresh_token) localStorage.setItem('spotify_refresh', refreshToken);
  localStorage.setItem('spotify_token_expiry', String(tokenExpiry));
}

function disconnectSpotify() {
  accessToken = null;
  refreshToken = null;
  tokenExpiry = 0;
  localStorage.removeItem('spotify_token');
  localStorage.removeItem('spotify_refresh');
  localStorage.removeItem('spotify_token_expiry');
  sdkReady = false;
  sdkDeviceId = null;
  if (spotifyPlayer) { spotifyPlayer.disconnect(); spotifyPlayer = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  window.location.reload();
}

function isTokenValid() {
  return accessToken && Date.now() < tokenExpiry - 60000;
}

async function ensureToken() {
  if (isTokenValid()) return true;
  return await refreshAccessToken();
}

// ---- API helpers ----

async function spGet(endpoint) {
  if (!await ensureToken()) return null;
  var url = endpoint.startsWith('http') ? endpoint : 'https://api.spotify.com/v1' + endpoint;
  var resp = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  if (resp.status === 401) {
    if (await refreshAccessToken()) return spGet(endpoint);
    return null;
  }
  if (resp.status === 204 || resp.status === 202) return {};
  if (!resp.ok) { console.warn('spGet error', resp.status, endpoint); return null; }
  return resp.json();
}

async function spPut(endpoint, body) {
  if (!await ensureToken()) return null;
  var resp = await fetch('https://api.spotify.com/v1' + endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (resp.status === 401) {
    if (await refreshAccessToken()) return spPut(endpoint, body);
    return null;
  }
  if (resp.status === 204 || resp.status === 202) return {};
  if (!resp.ok) { console.warn('spPut error', resp.status, endpoint); return null; }
  return resp.json().catch(function() { return {}; });
}

async function spPost(endpoint, body) {
  if (!await ensureToken()) return null;
  var resp = await fetch('https://api.spotify.com/v1' + endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (resp.status === 401) {
    if (await refreshAccessToken()) return spPost(endpoint, body);
    return null;
  }
  if (!resp.ok) { console.warn('spPost error', resp.status, endpoint); return null; }
  return resp.json().catch(function() { return {}; });
}

async function spDelete(endpoint, body) {
  if (!await ensureToken()) return null;
  var resp = await fetch('https://api.spotify.com/v1' + endpoint, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (resp.status === 401) {
    if (await refreshAccessToken()) return spDelete(endpoint, body);
    return null;
  }
  return {};
}

// ---- Playback ----

async function spotifyPlay(uris, offset) {
  var body = {};
  if (uris) body.uris = uris;
  if (typeof offset === 'number') body.offset = { position: offset };

  var deviceParam = sdkDeviceId ? '?device_id=' + sdkDeviceId : '';
  await spPut('/me/player/play' + deviceParam, body);
}

async function spotifyPause() {
  await spPut('/me/player/pause');
}

async function spotifyNext() {
  await spPost('/me/player/next');
}

async function spotifyPrev() {
  await spPost('/me/player/previous');
}

async function spotifySeek(posMs) {
  await spPut('/me/player/seek?position_ms=' + posMs);
}

async function spotifySetVolume(pct) {
  await spPut('/me/player/volume?volume_percent=' + pct);
}

// ---- SDK init ----

function initSpotifySDK() {
  window.onSpotifyWebPlaybackSDKReady = function() {
    if (!accessToken) return;
    spotifyPlayer = new Spotify.Player({
      name: 'signal.fm',
      getOAuthToken: function(cb) {
        ensureToken().then(function() { cb(accessToken); });
      },
      volume: 0.7
    });

    spotifyPlayer.addListener('ready', function(data) {
      sdkDeviceId = data.device_id;
      sdkReady = true;
      console.log('SDK ready, device:', sdkDeviceId);
    });

    spotifyPlayer.addListener('not_ready', function() {
      sdkReady = false;
      sdkDeviceId = null;
    });

    spotifyPlayer.addListener('player_state_changed', function(state) {
      if (state) onSDKStateChange(state);
    });

    spotifyPlayer.addListener('initialization_error', function(e) {
      console.warn('SDK init error:', e.message);
      startPollingFallback();
    });

    spotifyPlayer.addListener('authentication_error', function(e) {
      console.warn('SDK auth error:', e.message);
    });

    spotifyPlayer.connect();
  };
}

function startPollingFallback() {
  if (pollTimer) return;
  pollTimer = setInterval(pollNowPlaying, POLL_INTERVAL);
}

// ---- matchToSpotify ----

async function matchToSpotify(lfmTrack) {
  var q = 'track:' + lfmTrack.name + ' artist:' + lfmTrack.artist;
  var data = await spGet('/search?q=' + encodeURIComponent(q) + '&type=track&limit=5');
  if (!data) return null;
  var items = (data.tracks && data.tracks.items) || [];
  if (items.length === 0) return null;

  var exact = items.find(function(t) {
    return t.artists[0].name.toLowerCase() === lfmTrack.artist.toLowerCase();
  });
  var track = exact || items[0];

  return {
    uri: track.uri,
    id: track.id,
    name: track.name,
    artist: track.artists[0].name,
    artistId: track.artists[0].id,
    duration: track.duration_ms,
    albumArt: track.album.images[1] ? track.album.images[1].url : (track.album.images[0] ? track.album.images[0].url : ''),
    mbid: lfmTrack.mbid || null,
    _source: lfmTrack._source || 'artist_similar',
    _sourceDetail: lfmTrack._sourceDetail || ''
  };
}

// ---- Save playlist ----

async function savePlaylist() {
  if (sessionFeed.length === 0) return;
  var uris = sessionFeed.map(function(t) { return t.uri; });

  var now = new Date();
  var name = 'signal.fm - ' + now.toLocaleDateString();
  var playlist = await spPost('/me/playlists', {
    name: name,
    description: 'Discovered by signal.fm',
    public: false
  });
  if (!playlist || !playlist.id) return;

  // Add tracks in batches of 100
  for (var i = 0; i < uris.length; i += 100) {
    var batch = uris.slice(i, i + 100);
    await spPost('/playlists/' + playlist.id + '/items', { uris: batch });
  }
  alert('Playlist saved: ' + name);
}

// ---- Like/unlike ----

async function likeTrack(trackId) {
  await spPut('/me/library', { uris: ['spotify:track:' + trackId] });
  likedSet.add(trackId);
}

async function unlikeTrack(trackId) {
  await spDelete('/me/library', { uris: ['spotify:track:' + trackId] });
  likedSet.delete(trackId);
}

// ---- Fetch saved (liked) tracks for feed exclusion ----

async function fetchSavedTracks(maxTracks) {
  maxTracks = maxTracks || 500;
  var uris = [];
  var url = '/me/tracks?limit=50';
  while (url && uris.length < maxTracks) {
    var data = await spGet(url);
    if (!data || !data.items) break;
    for (var i = 0; i < data.items.length; i++) {
      if (data.items[i].track && data.items[i].track.uri) {
        uris.push(data.items[i].track.uri);
      }
    }
    if (data.next) {
      url = data.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = null;
    }
  }
  return uris;
}

async function checkLikedTracks(trackIds) {
  if (trackIds.length === 0) return;
  for (var i = 0; i < trackIds.length; i += 50) {
    var batch = trackIds.slice(i, i + 50);
    var uris = batch.map(function(id) { return 'spotify:track:' + id; });
    var data = await spGet('/me/library/contains?uris=' + uris.join(','));
    if (!data) continue;
    for (var j = 0; j < batch.length; j++) {
      if (data[j]) likedSet.add(batch[j]);
    }
  }
}
