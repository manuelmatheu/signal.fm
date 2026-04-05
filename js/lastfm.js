/* signal.fm -- lastfm.js
   Last.fm API calls: getSimilarArtists, getSimilarTracks, lfm(), auth, recommendations */

var LFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

// ---- Compact MD5 implementation (required for Last.fm API signatures) ----
// SubtleCrypto does not support MD5, so we use a small pure-JS implementation.

function md5(str) {
  function safeAdd(x, y) { var lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff); }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }

  var utf8 = unescape(encodeURIComponent(str));
  var m = [], i, l = utf8.length, state = [1732584193, -271733879, -1732584194, 271733878];
  for (i = 64; i <= l + 64; i += 64) {
    var chunk = utf8.slice(i - 64, i);
    var M = new Array(16);
    for (var j = 0; j < 64; j += 4) {
      M[j >> 2] = (chunk.charCodeAt(j) || 0) | ((chunk.charCodeAt(j+1) || 0) << 8) | ((chunk.charCodeAt(j+2) || 0) << 16) | ((chunk.charCodeAt(j+3) || 0) << 24);
    }
    if (i > l + 1) M[(l + 1 + 63 - ((l + 1 + 8) % 64)) >> 2] = 0;
    m = m.concat(M);
  }
  var len8 = l * 8;
  m[l >> 2] |= 0x80 << ((l % 4) * 8);
  m[((l + 72) >> 6 << 4) + 14] = len8 & 0xffffffff;
  m[((l + 72) >> 6 << 4) + 15] = Math.floor(len8 / 4294967296);

  var a = state[0], b = state[1], c = state[2], d = state[3];
  for (i = 0; i < m.length; i += 16) {
    var aa = a, bb = b, cc = c, dd = d;
    a = md5ff(a,b,c,d,m[i+0],7,-680876936); d = md5ff(d,a,b,c,m[i+1],12,-389564586); c = md5ff(c,d,a,b,m[i+2],17,606105819); b = md5ff(b,c,d,a,m[i+3],22,-1044525330);
    a = md5ff(a,b,c,d,m[i+4],7,-176418897); d = md5ff(d,a,b,c,m[i+5],12,1200080426); c = md5ff(c,d,a,b,m[i+6],17,-1473231341); b = md5ff(b,c,d,a,m[i+7],22,-45705983);
    a = md5ff(a,b,c,d,m[i+8],7,1770035416); d = md5ff(d,a,b,c,m[i+9],12,-1958414417); c = md5ff(c,d,a,b,m[i+10],17,-42063); b = md5ff(b,c,d,a,m[i+11],22,-1990404162);
    a = md5ff(a,b,c,d,m[i+12],7,1804603682); d = md5ff(d,a,b,c,m[i+13],12,-40341101); c = md5ff(c,d,a,b,m[i+14],17,-1502002290); b = md5ff(b,c,d,a,m[i+15],22,1236535329);
    a = md5gg(a,b,c,d,m[i+1],5,-165796510); d = md5gg(d,a,b,c,m[i+6],9,-1069501632); c = md5gg(c,d,a,b,m[i+11],14,643717713); b = md5gg(b,c,d,a,m[i+0],20,-373897302);
    a = md5gg(a,b,c,d,m[i+5],5,-701558691); d = md5gg(d,a,b,c,m[i+10],9,38016083); c = md5gg(c,d,a,b,m[i+15],14,-660478335); b = md5gg(b,c,d,a,m[i+4],20,-405537848);
    a = md5gg(a,b,c,d,m[i+9],5,568446438); d = md5gg(d,a,b,c,m[i+14],9,-1019803690); c = md5gg(c,d,a,b,m[i+3],14,-187363961); b = md5gg(b,c,d,a,m[i+8],20,1163531501);
    a = md5gg(a,b,c,d,m[i+13],5,-1444681467); d = md5gg(d,a,b,c,m[i+2],9,-51403784); c = md5gg(c,d,a,b,m[i+7],14,1735328473); b = md5gg(b,c,d,a,m[i+12],20,-1926607734);
    a = md5hh(a,b,c,d,m[i+5],4,-378558); d = md5hh(d,a,b,c,m[i+8],11,-2022574463); c = md5hh(c,d,a,b,m[i+11],16,1839030562); b = md5hh(b,c,d,a,m[i+14],23,-35309556);
    a = md5hh(a,b,c,d,m[i+1],4,-1530992060); d = md5hh(d,a,b,c,m[i+4],11,1272893353); c = md5hh(c,d,a,b,m[i+7],16,-155497632); b = md5hh(b,c,d,a,m[i+10],23,-1094730640);
    a = md5hh(a,b,c,d,m[i+13],4,681279174); d = md5hh(d,a,b,c,m[i+0],11,-358537222); c = md5hh(c,d,a,b,m[i+3],16,-722521979); b = md5hh(b,c,d,a,m[i+6],23,76029189);
    a = md5hh(a,b,c,d,m[i+9],4,-640364487); d = md5hh(d,a,b,c,m[i+12],11,-421815835); c = md5hh(c,d,a,b,m[i+15],16,530742520); b = md5hh(b,c,d,a,m[i+2],23,-995338651);
    a = md5ii(a,b,c,d,m[i+0],6,-198630844); d = md5ii(d,a,b,c,m[i+7],10,1126891415); c = md5ii(c,d,a,b,m[i+14],15,-1416354905); b = md5ii(b,c,d,a,m[i+5],21,-57434055);
    a = md5ii(a,b,c,d,m[i+12],6,1700485571); d = md5ii(d,a,b,c,m[i+3],10,-1894986606); c = md5ii(c,d,a,b,m[i+10],15,-1051523); b = md5ii(b,c,d,a,m[i+1],21,-2054922799);
    a = md5ii(a,b,c,d,m[i+8],6,1873313359); d = md5ii(d,a,b,c,m[i+15],10,-30611744); c = md5ii(c,d,a,b,m[i+6],15,-1560198380); b = md5ii(b,c,d,a,m[i+13],21,1309151649);
    a = md5ii(a,b,c,d,m[i+4],6,-145523070); d = md5ii(d,a,b,c,m[i+11],10,-1120210379); c = md5ii(c,d,a,b,m[i+2],15,718787259); b = md5ii(b,c,d,a,m[i+9],21,-343485551);
    a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
  }

  function hex(n) { var s = ''; for (var j = 0; j < 4; j++) s += ('0' + ((n >> (j * 8 + 4)) & 0x0f).toString(16)).slice(-1) + ('0' + ((n >> (j * 8)) & 0x0f).toString(16)).slice(-1); return s; }
  return hex(a) + hex(b) + hex(c) + hex(d);
}

// ---- Last.fm API signature ----

function lfmSign(params) {
  var keys = Object.keys(params).filter(function(k) { return k !== 'format'; }).sort();
  var str = keys.map(function(k) { return k + params[k]; }).join('') + LFM_SECRET;
  return md5(str);
}

// ---- Last.fm authentication ----

function startLfmAuth(onSuccess) {
  var authUrl = 'https://www.last.fm/api/auth?api_key=' + LFM_KEY + '&cb=' + encodeURIComponent(REDIRECT_URI);
  var popup = window.open(authUrl, 'lfm_auth', 'width=500,height=600,left=200,top=100');

  // If popup was blocked, fall back to redirect
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.location.href = authUrl;
    return;
  }

  // Popup will postMessage the token back when it lands on the callback URL
  function onMessage(e) {
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.type !== 'lfm_token') return;
    window.removeEventListener('message', onMessage);
    exchangeLfmToken(e.data.token).then(function(key) {
      if (key && typeof onSuccess === 'function') onSuccess();
    });
  }
  window.addEventListener('message', onMessage);
}

async function exchangeLfmToken(token) {
  var params = { method: 'auth.getSession', api_key: LFM_KEY, token: token };
  params.api_sig = lfmSign(params);
  params.format = 'json';
  var resp = await fetch(LFM_BASE + '?' + new URLSearchParams(params));
  if (!resp.ok) { console.warn('Last.fm session exchange failed', resp.status); return null; }
  var data = await resp.json();
  if (data && data.session && data.session.key) {
    LFM_SESSION_KEY = data.session.key;
    localStorage.setItem('signal_lfm_session', LFM_SESSION_KEY);
    return LFM_SESSION_KEY;
  }
  console.warn('Last.fm session exchange error', data);
  return null;
}

// ---- Last.fm personalized recommendations ----

async function getLfmRecommendedTracks(limit) {
  if (!LFM_SESSION_KEY) return [];
  limit = limit || 50;
  var params = { method: 'user.getRecommendedTracks', api_key: LFM_KEY, sk: LFM_SESSION_KEY, limit: String(limit) };
  params.api_sig = lfmSign(params);
  params.format = 'json';
  var resp = await fetch(LFM_BASE + '?' + new URLSearchParams(params));
  if (!resp.ok) { console.warn('getLfmRecommendedTracks error', resp.status); return []; }
  var data = await resp.json();
  if (!data || !data.recommendations || !data.recommendations.track) return [];
  var tracks = data.recommendations.track;
  if (!Array.isArray(tracks)) tracks = [tracks];
  return tracks.map(function(t) {
    return { name: t.name, artist: t.artist ? t.artist.name : '', mbid: t.mbid || null };
  });
}

async function lfm(params) {
  params.api_key = LFM_KEY;
  params.format = 'json';
  var qs = new URLSearchParams(params).toString();
  var resp = await fetch(LFM_BASE + '?' + qs);
  if (!resp.ok) { console.warn('Last.fm error', resp.status, params.method); return null; }
  return resp.json();
}

async function getSimilarArtists(artistName, limit) {
  limit = limit || 20;
  var data = await lfm({
    method: 'artist.getSimilar',
    artist: artistName,
    limit: String(limit)
  });
  if (!data || !data.similarartists || !data.similarartists.artist) return [];
  return data.similarartists.artist.map(function(a) {
    return {
      name: a.name,
      match: parseFloat(a.match) || 0,
      mbid: a.mbid || null
    };
  });
}

async function getSimilarTracks(trackName, artistName, limit) {
  limit = limit || 20;
  var data = await lfm({
    method: 'track.getSimilar',
    track: trackName,
    artist: artistName,
    limit: String(limit)
  });
  if (!data || !data.similartracks || !data.similartracks.track) return [];
  return data.similartracks.track.map(function(t) {
    return {
      name: t.name,
      artist: t.artist ? t.artist.name : '',
      match: parseFloat(t.match) || 0,
      mbid: t.mbid || null
    };
  });
}

async function getArtistDeepCuts(artistName, limit) {
  limit = limit || 50;
  var data = await lfm({
    method: 'artist.getTopTracks',
    artist: artistName,
    limit: String(limit),
    autocorrect: '1'
  });
  if (!data || !data.toptracks || !data.toptracks.track) return [];
  var tracks = data.toptracks.track;
  if (!Array.isArray(tracks)) tracks = [tracks];
  // Skip top 10 (well-known hits), take positions 11-30
  return tracks.slice(10, 30).map(function(t) {
    return { name: t.name, artist: artistName, mbid: t.mbid || null, _source: 'deep_cut', _sourceDetail: artistName };
  });
}

async function getUserRecentTracks(username, limit) {
  limit = limit || 50;
  var data = await lfm({
    method: 'user.getRecentTracks',
    user: username,
    limit: String(limit)
  });
  if (!data || !data.recenttracks || !data.recenttracks.track) return [];
  return data.recenttracks.track;
}
