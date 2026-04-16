/* signal.fm -- player.js
   SDK events, polling fallback, player bar UI, liked songs */

// ---- Ambient background -- cinematic album art atmosphere ----

var _ambientUseA = true;
var _ambientLastUrl = '';

function updateAmbientBackground(artUrl) {
  if (!artUrl || artUrl === _ambientLastUrl) return;
  _ambientLastUrl = artUrl;

  var imgA = document.getElementById('ambient-img-a');
  var imgB = document.getElementById('ambient-img-b');
  if (!imgA || !imgB) return;

  var target = _ambientUseA ? imgA : imgB;
  var other  = _ambientUseA ? imgB : imgA;

  target.onload = function() {
    target.classList.add('active');
    other.classList.remove('active');
  };
  target.src = artUrl;
  _ambientUseA = !_ambientUseA;
}

// ---- SDK state change handler ----

function onSDKStateChange(state) {
  if (!state || !state.track_window || !state.track_window.current_track) return;

  var t = state.track_window.current_track;
  isPlaying = !state.paused;

  currentTrack = {
    uri: t.uri,
    id: t.id || (t.uri ? t.uri.split(':')[2] : ''),
    name: t.name,
    artist: t.artists[0].name,
    artistId: t.artists[0].uri ? t.artists[0].uri.split(':')[2] : '',
    duration: t.duration_ms,
    albumArt: t.album.images[1] ? t.album.images[1].url : (t.album.images[0] ? t.album.images[0].url : ''),
    position: state.position
  };

  updatePlayerBar();
  highlightNowPlaying(currentTrack.uri);
  if (typeof checkQueueRefill === 'function') checkQueueRefill();
}

// ---- Polling fallback for mobile ----

async function pollNowPlaying() {
  var data = await spGet('/me/player/currently-playing');
  if (!data || !data.item) return;

  var t = data.item;
  isPlaying = data.is_playing;

  currentTrack = {
    uri: t.uri,
    id: t.id,
    name: t.name,
    artist: t.artists[0].name,
    artistId: t.artists[0].id,
    duration: t.duration_ms,
    albumArt: t.album.images[1] ? t.album.images[1].url : (t.album.images[0] ? t.album.images[0].url : ''),
    position: data.progress_ms || 0
  };

  updatePlayerBar();
  highlightNowPlaying(currentTrack.uri);
}

// ---- Player bar UI updates ----

function updatePlayerBar() {
  if (!currentTrack) return;

  var bar = document.getElementById('player-bar');
  var isFirstShow = bar.style.display !== 'flex';
  bar.style.display = 'flex';
  document.body.classList.add('has-player');
  if (isFirstShow) {
    void bar.offsetWidth;
    bar.classList.add('entering');
    bar.addEventListener('animationend', function() { bar.classList.remove('entering'); }, { once: true });
  }

  document.getElementById('player-art').src = currentTrack.albumArt;
  document.getElementById('player-track-name').textContent = currentTrack.name;
  document.getElementById('player-artist-name').textContent = currentTrack.artist;

  // Cinematic ambient background
  updateAmbientBackground(currentTrack.albumArt);
  if (isPlaying) {
    bar.classList.add('is-playing');
  } else {
    bar.classList.remove('is-playing');
  }

  // Play/pause icons
  var playIcon = document.querySelector('#player-play .icon-play');
  var pauseIcon = document.querySelector('#player-play .icon-pause');
  if (playIcon && pauseIcon) {
    playIcon.style.display = isPlaying ? 'none' : 'inline';
    pauseIcon.style.display = isPlaying ? 'inline' : 'none';
  }

  // Progress
  if (currentTrack.duration > 0) {
    var pct = ((currentTrack.position || 0) / currentTrack.duration) * 100;
    document.getElementById('player-progress').style.width = pct + '%';
    document.getElementById('player-time-current').textContent = formatTime(currentTrack.position || 0);
    document.getElementById('player-time-total').textContent = formatTime(currentTrack.duration);
  }

  // Heart state
  updatePlayerBarHeart();
}

function updatePlayerBarHeart() {
  if (!currentTrack) return;
  var heartBtn = document.getElementById('player-heart');
  if (likedSet.has(currentTrack.id)) {
    heartBtn.classList.add('liked');
  } else {
    heartBtn.classList.remove('liked');
  }
}

function formatTime(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  s = s % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ---- Highlight now playing in feed ----

function highlightNowPlaying(uri) {
  // Remove previous highlight
  var prev = document.querySelector('.track-item.now-playing');
  if (prev) prev.classList.remove('now-playing');

  if (!uri) return;
  var card = document.querySelector('.track-item[data-uri="' + CSS.escape(uri) + '"]');
  if (card) card.classList.add('now-playing');
}

// ---- Play from feed ----

function playFromFeed(uri) {
  // Build a list of URIs from the feed starting at the clicked track
  var uris = [];
  var startIdx = -1;
  for (var i = 0; i < sessionFeed.length; i++) {
    uris.push(sessionFeed[i].uri);
    if (sessionFeed[i].uri === uri) startIdx = i;
  }
  if (startIdx === -1) {
    spotifyPlay([uri]);
    return;
  }
  spotifyPlay(uris, startIdx);
}

// ---- Progress bar interaction ----

function initProgressBar() {
  var bar = document.getElementById('player-progress-bar');
  bar.addEventListener('click', function(e) {
    if (!currentTrack || !currentTrack.duration) return;
    var rect = bar.getBoundingClientRect();
    var pct = (e.clientX - rect.left) / rect.width;
    var posMs = Math.floor(pct * currentTrack.duration);
    spotifySeek(posMs);
    document.getElementById('player-progress').style.width = (pct * 100) + '%';
    document.getElementById('player-time-current').textContent = formatTime(posMs);
  });
}

// ---- Progress polling (for smooth updates) ----

var progressTimer = null;

function startProgressPolling() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(function() {
    if (!currentTrack || !isPlaying) return;
    currentTrack.position = (currentTrack.position || 0) + 1000;
    if (currentTrack.position > currentTrack.duration) currentTrack.position = currentTrack.duration;
    var pct = (currentTrack.position / currentTrack.duration) * 100;
    document.getElementById('player-progress').style.width = pct + '%';
    document.getElementById('player-time-current').textContent = formatTime(currentTrack.position);
  }, 1000);
}

// ---- Player controls wiring ----

function initPlayerControls() {
  document.getElementById('player-play').addEventListener('click', function() {
    if (isPlaying) {
      spotifyPause();
      isPlaying = false;
    } else {
      spotifyPlay();
      isPlaying = true;
    }
    updatePlayerBar();
  });

  document.getElementById('player-prev').addEventListener('click', function() {
    spotifyPrev();
  });

  document.getElementById('player-next').addEventListener('click', function() {
    spotifyNext();
    // Treat skip as soft negative signal
    if (currentTrack) onSkip(currentTrack);
  });

  document.getElementById('player-heart').addEventListener('click', function() {
    if (!currentTrack) return;
    var wasLiked = likedSet.has(currentTrack.id);
    if (wasLiked) {
      unlikeTrack(currentTrack.id);
    } else {
      likeTrack(currentTrack.id);
      onLike(currentTrack);
      // Heart pop
      var heartBtn = this;
      heartBtn.classList.remove('anim-like');
      void heartBtn.offsetWidth;
      heartBtn.classList.add('anim-like');
      heartBtn.addEventListener('animationend', function() { heartBtn.classList.remove('anim-like'); }, { once: true });
    }
    updatePlayerBarHeart();
    // Update card heart too
    var card = document.querySelector('.track-item[data-uri="' + CSS.escape(currentTrack.uri) + '"]');
    if (card) {
      var cardHeart = card.querySelector('.card-heart-btn');
      if (cardHeart) {
        if (likedSet.has(currentTrack.id)) {
          cardHeart.classList.add('liked');
        } else {
          cardHeart.classList.remove('liked');
        }
      }
    }
  });

  document.getElementById('player-volume').addEventListener('input', function(e) {
    spotifySetVolume(parseInt(e.target.value, 10));
  });

  initProgressBar();
  startProgressPolling();
}
