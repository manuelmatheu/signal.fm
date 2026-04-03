/* signal.fm -- config.js
   API keys, OAuth scopes, global state, constants */

// Spotify OAuth
var CLIENT_ID = '73fce01f5762463e86ff6555751a148c';
var REDIRECT_URI = window.location.origin + window.location.pathname;
var SCOPES = [
  'user-read-private', 'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-modify-playback-state', 'user-read-playback-state', 'user-read-currently-playing',
  'playlist-modify-public', 'playlist-modify-private',
  'streaming', 'user-library-modify', 'user-library-read'
].join(' ');

// Last.fm
var LFM_KEY = '177b9e8ee70fe2325bfff606cfdaee23';
var LFM_SECRET = 'YOUR_LFM_SECRET_HERE'; // replace with your Last.fm API secret from last.fm/api/accounts
var LFM_SESSION_KEY = localStorage.getItem('signal_lfm_session') || null;

// Seed pool -- weighted map of artists and tracks driving all four signals
var seedPool = {
  artists: {},   // { 'Radiohead': 1.0, 'Portishead': 0.8 }
  tracks: {}     // { 'track_mbid_or_uri': 1.0 }
};

// Signal toggles
var signalWeights = {
  artistSimilar:   true,
  trackSimilar:    true,
  newReleases:     true,
  deepCuts:        true,
  lfmRecommended:  true
};

// Constants
var NEW_RELEASE_WINDOW_DAYS = 180;
var NEW_RELEASE_MAX_ARTISTS = 5;
var FEED_BATCH_SIZE = 20;
var ARTIST_ID_CACHE_TTL = 86400000; // 24h in ms
var POLL_INTERVAL = 5000; // 5s for mobile fallback

// Session state
var heardUris = new Set();
var sessionFeed = [];
var isLoadingMore = false;
var candidateBuffer = []; // pre-generated next batch

// Spotify SDK state
var sdkReady = false;
var sdkDeviceId = null;
var spotifyPlayer = null;
var currentTrack = null;
var isPlaying = false;
var likedSet = new Set();
var pollTimer = null;

// User profile
var userMarket = null;

// Token state
var accessToken = localStorage.getItem('spotify_token') || null;
var refreshToken = localStorage.getItem('spotify_refresh') || null;
var tokenExpiry = parseInt(localStorage.getItem('spotify_token_expiry') || '0', 10);
