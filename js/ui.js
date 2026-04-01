/* signal.fm -- ui.js
   Feed render, infinite scroll, signal toggles, badges, init() */

// ---- Render track rows (playlist-style) ----

function renderTracks(tracks) {
  var feed = document.getElementById('feed');
  var startIdx = sessionFeed.length - tracks.length;

  for (var i = 0; i < tracks.length; i++) {
    var t = tracks[i];
    var rowNum = startIdx + i + 1;
    var row = document.createElement('div');
    row.className = 'track-item';
    row.setAttribute('data-uri', t.uri);
    row.setAttribute('data-id', t.id);

    var badgeText = getBadgeText(t);
    var isLiked = likedSet.has(t.id);

    row.innerHTML =
      '<div class="track-num-wrap">' +
        '<span class="track-num">' + rowNum + '</span>' +
        '<span class="track-play-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>' +
      '</div>' +
      '<img class="track-thumb" src="' + escapeAttr(t.albumArt || '') + '" alt="" loading="lazy">' +
      '<div class="track-info">' +
        '<div class="track-name">' + escapeHtml(t.name) + '</div>' +
        '<div class="track-artist">' + escapeHtml(t.artist) + '</div>' +
      '</div>' +
      '<span class="track-source-badge source-' + t._source + '">' + escapeHtml(badgeText) + '</span>' +
      '<span class="track-duration">' + formatDuration(t.duration) + '</span>' +
      '<button class="card-heart-btn' + (isLiked ? ' liked' : '') + '" title="Like" data-id="' + escapeAttr(t.id) + '">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="' + (isLiked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
      '</button>';

    // Click to play
    row.addEventListener('click', (function(uri) {
      return function(e) {
        if (e.target.closest('.card-heart-btn')) return;
        playFromFeed(uri);
      };
    })(t.uri));

    // Heart button
    var heartBtn = row.querySelector('.card-heart-btn');
    heartBtn.addEventListener('click', (function(track) {
      return function(e) {
        e.stopPropagation();
        var btn = e.currentTarget;
        var id = btn.getAttribute('data-id');
        if (likedSet.has(id)) {
          unlikeTrack(id);
          btn.classList.remove('liked');
          btn.querySelector('svg').setAttribute('fill', 'none');
        } else {
          likeTrack(id);
          onLike(track);
          btn.classList.add('liked');
          btn.querySelector('svg').setAttribute('fill', 'currentColor');
        }
        updatePlayerBarHeart();
      };
    })(t));

    feed.appendChild(row);
  }
}

function formatDuration(ms) {
  if (!ms) return '';
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  s = s % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function getBadgeText(track) {
  switch (track._source) {
    case 'artist_similar':
      return track._sourceDetail ? 'Similar to ' + track._sourceDetail : 'Similar artist';
    case 'track_similar':
      return track._sourceDetail ? 'Because you liked ' + track._sourceDetail : 'Similar track';
    case 'new_release':
      return 'New release';
    default:
      return 'Discovered';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Infinite scroll ----

function initInfiniteScroll() {
  var sentinel = document.getElementById('feed-sentinel');
  var observer = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting && !isLoadingMore) {
      isLoadingMore = true;
      loadNextBatch().then(function() {
        isLoadingMore = false;
      }).catch(function(err) {
        console.error('loadNextBatch error:', err);
        isLoadingMore = false;
      });
    }
  }, { rootMargin: '200px' });
  observer.observe(sentinel);
}

async function loadNextBatch() {
  // Use pre-generated buffer if available
  var candidates;
  if (candidateBuffer.length > 0) {
    candidates = candidateBuffer;
    candidateBuffer = [];
  } else {
    candidates = await fetchCandidates();
  }

  var resolved = [];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];

    // Skip if already seen
    if (c.uri && heardUris.has(c.uri)) continue;

    var track;
    if (c._resolved || c._source === 'new_release') {
      track = c;
    } else {
      track = await matchToSpotify(c);
    }
    if (!track) continue;
    if (heardUris.has(track.uri)) continue;

    heardUris.add(track.uri);
    resolved.push(track);
    if (resolved.length >= FEED_BATCH_SIZE) break;
  }

  if (resolved.length > 0) {
    sessionFeed.push.apply(sessionFeed, resolved);
    renderTracks(resolved);

    // Check liked status for new tracks
    var ids = resolved.map(function(t) { return t.id; });
    checkLikedTracks(ids).then(function() {
      updateLikedStatesInFeed();
    });

    // Show save playlist button
    document.getElementById('save-playlist-btn').style.display = '';
  }

  // Pre-generate next batch in background
  if (candidateBuffer.length === 0) {
    fetchCandidates().then(function(next) {
      candidateBuffer = next;
    }).catch(function() {});
  }

  // Show empty state if no results
  if (sessionFeed.length === 0) {
    document.getElementById('feed-empty').style.display = 'block';
  }
}

function updateLikedStatesInFeed() {
  var hearts = document.querySelectorAll('.card-heart-btn');
  for (var i = 0; i < hearts.length; i++) {
    var id = hearts[i].getAttribute('data-id');
    if (likedSet.has(id)) {
      hearts[i].classList.add('liked');
    } else {
      hearts[i].classList.remove('liked');
    }
  }
}

// ---- Signal toggles ----

function initSignalToggles() {
  document.getElementById('toggle-artist-similar').addEventListener('change', function(e) {
    signalWeights.artistSimilar = e.target.checked;
    candidateBuffer = []; // clear buffer to refetch
  });
  document.getElementById('toggle-track-similar').addEventListener('change', function(e) {
    signalWeights.trackSimilar = e.target.checked;
    candidateBuffer = [];
  });
  document.getElementById('toggle-new-releases').addEventListener('change', function(e) {
    signalWeights.newReleases = e.target.checked;
    candidateBuffer = [];
  });
}

// ---- Last.fm username ----

function initLastfm() {
  var input = document.getElementById('lfm-username');
  var saved = localStorage.getItem('signal_lfm_username');
  if (saved) {
    input.value = saved;
    document.getElementById('lfm-status').textContent = 'Connected: ' + saved;
  }

  document.getElementById('lfm-save-btn').addEventListener('click', function() {
    var val = input.value.trim();
    if (val) {
      localStorage.setItem('signal_lfm_username', val);
      document.getElementById('lfm-status').textContent = 'Connected: ' + val;
    } else {
      localStorage.removeItem('signal_lfm_username');
      document.getElementById('lfm-status').textContent = 'Adds scrobble history to your seed pool';
    }
  });
}

// ---- Seed artist list display ----

function updateSeedDisplay() {
  var container = document.getElementById('seed-artist-list');
  var entries = Object.entries(seedPool.artists);
  entries.sort(function(a, b) { return b[1] - a[1]; });

  if (entries.length === 0) {
    container.innerHTML = '<p class="sidebar-hint">No seeds yet</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < Math.min(entries.length, 20); i++) {
    html += '<div class="seed-item"><span>' + escapeHtml(entries[i][0]) + '</span><span class="seed-weight">' + entries[i][1].toFixed(1) + '</span></div>';
  }
  if (entries.length > 20) {
    html += '<p class="sidebar-hint">+' + (entries.length - 20) + ' more</p>';
  }
  container.innerHTML = html;
}

// ---- Theme toggle ----

function initTheme() {
  document.getElementById('theme-toggle').addEventListener('click', function() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mixtape_theme', next);
  });
}

// ---- OAuth callback handling ----

async function handleCallback() {
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  if (code) {
    var ok = await exchangeCode(code);
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
    return ok;
  }
  return false;
}

// ---- Main init ----

async function init() {
  initTheme();
  initLastfm();
  initSignalToggles();
  initPlayerControls();

  // Handle OAuth callback
  var justConnected = await handleCallback();

  // Check if connected
  if (!accessToken) {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('connect-btn').style.display = '';
    document.getElementById('disconnect-btn').style.display = 'none';

    document.getElementById('connect-btn').addEventListener('click', startAuth);
    document.getElementById('welcome-connect-btn').addEventListener('click', startAuth);
    return;
  }

  // Connected state
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('connect-btn').style.display = 'none';
  document.getElementById('disconnect-btn').style.display = '';
  document.getElementById('feed-loading').style.display = 'flex';

  document.getElementById('disconnect-btn').addEventListener('click', disconnectSpotify);
  document.getElementById('save-playlist-btn').addEventListener('click', savePlaylist);

  // Init SDK
  initSpotifySDK();

  // Build or rebuild seed pool
  if (needsSeedRebuild() || justConnected) {
    await buildSeedPool();
  } else {
    // Restore seed pool from top artists at minimum
    await buildSeedPool();
  }

  updateSeedDisplay();

  // Show feed, hide loading
  document.getElementById('feed-loading').style.display = 'none';
  document.getElementById('feed').style.display = 'block';

  // Load first batch
  await loadNextBatch();

  // Start infinite scroll
  initInfiniteScroll();

  // Start polling fallback if SDK not ready after 5s
  setTimeout(function() {
    if (!sdkReady) startPollingFallback();
  }, 5000);
}

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', init);
