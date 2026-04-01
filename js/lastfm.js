/* signal.fm -- lastfm.js
   Last.fm API calls: getSimilarArtists, getSimilarTracks, lfm() */

var LFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

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
