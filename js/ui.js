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
    case 'deep_cut':
      return track._sourceDetail ? track._sourceDetail + ' deep cut' : 'Deep cut';
    case 'lfm_recommended':
      return 'Last.fm picks';
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

// ---- Queue refill: load more when 3 tracks from end ----

function checkQueueRefill() {
  if (!currentTrack || isLoadingMore) return;
  var idx = -1;
  for (var i = 0; i < sessionFeed.length; i++) {
    if (sessionFeed[i].uri === currentTrack.uri) { idx = i; break; }
  }
  if (idx === -1) return;
  if (sessionFeed.length - 1 - idx > 3) return;

  isLoadingMore = true;
  loadNextBatch().then(function() {
    isLoadingMore = false;
    // Extend Spotify's queue with the new tracks
    if (!sdkDeviceId || !currentTrack) return;
    var newIdx = -1;
    for (var i = 0; i < sessionFeed.length; i++) {
      if (sessionFeed[i].uri === currentTrack.uri) { newIdx = i; break; }
    }
    if (newIdx === -1) return;
    var uris = sessionFeed.map(function(t) { return t.uri; });
    var savedPos = currentTrack.position || 0;
    spotifyPlay(uris, newIdx).then(function() {
      if (savedPos > 2000) setTimeout(function() { spotifySeek(savedPos); }, 500);
    });
  }).catch(function() { isLoadingMore = false; });
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
      // Small delay between Spotify search calls to avoid 429s
      await new Promise(function(r) { setTimeout(r, 120); });
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

function onSignalToggle() {
  candidateBuffer = [];
  if (!currentTrack || !sdkDeviceId) return;

  // Find current track position in feed
  var idx = -1;
  for (var i = 0; i < sessionFeed.length; i++) {
    if (sessionFeed[i].uri === currentTrack.uri) { idx = i; break; }
  }
  if (idx === -1) return;

  // Remove un-played tracks so they can be re-fetched with new signal weights
  var removed = sessionFeed.splice(idx + 1);
  for (var i = 0; i < removed.length; i++) heardUris.delete(removed[i].uri);

  // Remove their DOM cards
  var cards = document.querySelectorAll('#feed .track-item');
  for (var i = idx + 1; i < cards.length; i++) cards[i].remove();

  // Load fresh batch immediately
  if (isLoadingMore) return;
  isLoadingMore = true;
  loadNextBatch().then(function() {
    isLoadingMore = false;
    // Update Spotify queue with new tail
    var newIdx = -1;
    for (var i = 0; i < sessionFeed.length; i++) {
      if (sessionFeed[i].uri === currentTrack.uri) { newIdx = i; break; }
    }
    if (newIdx !== -1) {
      var uris = sessionFeed.map(function(t) { return t.uri; });
      spotifyPlay(uris, newIdx);
    }
  }).catch(function() { isLoadingMore = false; });
}

function animateChip(checkbox, isOn) {
  var label = checkbox.closest('.signal-chip');
  if (!label) return;
  label.classList.remove('chip-anim-on', 'chip-anim-off');
  void label.offsetWidth;
  label.classList.add(isOn ? 'chip-anim-on' : 'chip-anim-off');
  label.addEventListener('animationend', function() {
    label.classList.remove('chip-anim-on', 'chip-anim-off');
  }, { once: true });
}

function initSignalToggles() {
  document.getElementById('toggle-artist-similar').addEventListener('change', function(e) {
    animateChip(e.target, e.target.checked);
    signalWeights.artistSimilar = e.target.checked;
    onSignalToggle();
  });
  document.getElementById('toggle-track-similar').addEventListener('change', function(e) {
    animateChip(e.target, e.target.checked);
    signalWeights.trackSimilar = e.target.checked;
    onSignalToggle();
  });
  document.getElementById('toggle-new-releases').addEventListener('change', function(e) {
    animateChip(e.target, e.target.checked);
    signalWeights.newReleases = e.target.checked;
    onSignalToggle();
  });
  document.getElementById('toggle-deep-cuts').addEventListener('change', function(e) {
    animateChip(e.target, e.target.checked);
    signalWeights.deepCuts = e.target.checked;
    onSignalToggle();
  });
  var lfmRecToggle = document.getElementById('toggle-lfm-recommended');
  if (lfmRecToggle) {
    lfmRecToggle.addEventListener('change', function(e) {
      animateChip(e.target, e.target.checked);
      signalWeights.lfmRecommended = e.target.checked;
      onSignalToggle();
    });
  }
}

// ---- Last.fm auth connect/disconnect ----

function initLfmAuth() {
  var btn = document.getElementById('lfm-connect-btn');
  var statusEl = document.getElementById('lfm-rec-status');
  var toggleRow = document.getElementById('toggle-row-lfm-recommended');
  if (!btn) return;

  function setConnected() {
    btn.textContent = 'Disconnect';
    statusEl.textContent = 'Personalized picks enabled';
    if (toggleRow) toggleRow.style.display = '';
  }

  function setDisconnected() {
    btn.textContent = 'Connect Last.fm';
    statusEl.textContent = 'Connect for personalized recommendations';
    if (toggleRow) toggleRow.style.display = 'none';
  }

  if (LFM_SESSION_KEY) {
    setConnected();
    btn.addEventListener('click', function() {
      LFM_SESSION_KEY = null;
      localStorage.removeItem('signal_lfm_session');
      candidateBuffer = [];
      setDisconnected();
    });
  } else {
    setDisconnected();
    function onConnectClick() {
      startLfmAuth(function() {
        btn.removeEventListener('click', onConnectClick);
        setConnected();
        btn.addEventListener('click', function onDisconnectClick() {
          LFM_SESSION_KEY = null;
          localStorage.removeItem('signal_lfm_session');
          candidateBuffer = [];
          setDisconnected();
          btn.removeEventListener('click', onDisconnectClick);
          btn.addEventListener('click', onConnectClick);
        });
      });
    }
    btn.addEventListener('click', onConnectClick);
  }
}

// ---- Last.fm username ----

function initLastfm() {
  var input = document.getElementById('lfm-username');
  if (!input) return;
  var saved = localStorage.getItem('signal_lfm_username');
  if (saved) {
    input.value = saved;
    var statusEl = document.getElementById('lfm-status');
    if (statusEl) statusEl.textContent = 'Connected: ' + saved;
  }

  var saveBtn = document.getElementById('lfm-save-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', function() {
    var val = input.value.trim();
    var statusEl = document.getElementById('lfm-status');
    if (val) {
      localStorage.setItem('signal_lfm_username', val);
      if (statusEl) statusEl.textContent = 'Connected: ' + val;
    } else {
      localStorage.removeItem('signal_lfm_username');
      if (statusEl) statusEl.textContent = 'Adds scrobble history to your seed pool';
    }
  });
}

// ---- Seed artist list display ----

function updateSeedDisplay() {
  var container = document.getElementById('seed-artist-list');
  if (!container) return;
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

// ---- Feed context / liner notes ----

function renderFeedContext() {
  var ctx = document.getElementById('feed-context');
  if (!ctx || sessionFeed.length === 0) return;

  // Top 5 seed artists by weight
  var entries = Object.entries(seedPool.artists);
  entries.sort(function(a, b) { return b[1] - a[1]; });
  var topSeeds = entries.slice(0, 5);

  // Count tracks by source
  var counts = {};
  for (var i = 0; i < sessionFeed.length; i++) {
    var src = sessionFeed[i]._source || 'unknown';
    counts[src] = (counts[src] || 0) + 1;
  }

  // Active signals
  var activeSignals = [];
  if (signalWeights.artistSimilar) activeSignals.push('artist similarity');
  if (signalWeights.trackSimilar) activeSignals.push('track similarity');
  if (signalWeights.newReleases) activeSignals.push('new releases');
  if (signalWeights.lfmRecommended) activeSignals.push('Last.fm picks');

  // Narrative
  var seedNames = topSeeds.slice(0, 3).map(function(e) { return e[0]; });
  var narrative = 'Your feed is shaped by ' + activeSignals.length +
    ' signal' + (activeSignals.length !== 1 ? 's' : '') +
    (seedNames.length > 0 ? ', seeded from artists like ' + seedNames.join(', ') : '') + '.';
  document.getElementById('feed-context-narrative').textContent = narrative;

  // Seed pills
  var seedsHtml = '';
  for (var s = 0; s < topSeeds.length; s++) {
    seedsHtml += '<span class="feed-context-seed-pill">' + escapeHtml(topSeeds[s][0]) + '</span>';
  }
  document.getElementById('feed-context-seeds').innerHTML = seedsHtml;

  // Signal breakdown
  var sourceLabels = {
    artist_similar: { label: 'Similar artists', cls: 'source-artist_similar' },
    track_similar:  { label: 'Similar tracks',  cls: 'source-track_similar' },
    new_release:    { label: 'New releases',    cls: 'source-new_release' },
    lfm_recommended:{ label: 'Last.fm picks',   cls: 'source-lfm_recommended' }
  };
  var signalsHtml = '';
  for (var key in counts) {
    var info = sourceLabels[key] || { label: key, cls: '' };
    signalsHtml += '<span class="track-source-badge ' + info.cls + '">' +
      escapeHtml(info.label) + ': ' + counts[key] + '</span>';
  }
  document.getElementById('feed-context-signals').innerHTML = signalsHtml;

  ctx.style.display = 'block';

  document.getElementById('feed-context-toggle').addEventListener('click', function() {
    ctx.classList.toggle('collapsed');
  });
}

// ---- Autoplay first track ----

function autoplayFirstTrack() {
  if (sessionFeed.length === 0) return;
  var uri = sessionFeed[0].uri;

  if (sdkReady && sdkDeviceId) {
    playFromFeed(uri);
    return;
  }

  // Wait up to 5s for SDK device to be ready before attempting playback
  var attempts = 0;
  var check = setInterval(function() {
    attempts++;
    if ((sdkReady && sdkDeviceId) || attempts >= 10) {
      clearInterval(check);
      playFromFeed(uri);
    }
  }, 500);
}

// ---- Hamburger menu (mobile drawer) ----

function initHamburgerMenu() {
  var btn = document.getElementById('hamburger-btn');
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebar-backdrop');
  if (!btn || !sidebar || !backdrop) return;

  function openSidebar() {
    sidebar.classList.add('open');
    backdrop.classList.add('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  }

  btn.addEventListener('click', function() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop.addEventListener('click', closeSidebar);
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

  // Last.fm auth callback
  var lfmToken = params.get('token');
  if (lfmToken && !params.get('code')) {
    if (window.opener) {
      // We're in the popup -- hand token to parent and close
      window.opener.postMessage({ type: 'lfm_token', token: lfmToken }, window.location.origin);
      window.close();
      return false;
    }
    // Fallback: redirect flow (no popup)
    await exchangeLfmToken(lfmToken);
    window.history.replaceState({}, '', window.location.pathname);
    return false;
  }

  // Spotify OAuth callback
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
  initLfmAuth();
  initSignalToggles();
  initPlayerControls();
  initHamburgerMenu();

  // Handle OAuth callback
  var justConnected = await handleCallback();

  // Check if connected
  if (!accessToken) {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('disconnect-btn').style.display = 'none';

    document.getElementById('welcome-connect-btn').addEventListener('click', startAuth);
    return;
  }

  // Connected state
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('disconnect-btn').style.display = '';
  document.getElementById('feed-loading').style.display = 'flex';

  document.getElementById('disconnect-btn').addEventListener('click', disconnectSpotify);
  document.getElementById('save-playlist-btn').addEventListener('click', savePlaylist);

  // Init SDK
  initSpotifySDK();

  // Build seed pool
  await buildSeedPool();
  updateSeedDisplay();

  // Pre-seed heardUris with library tracks so they are excluded from the feed.
  // Also populate likedSet from the same data.
  var libraryUris = await fetchSavedTracks(500);
  for (var li = 0; li < libraryUris.length; li++) {
    heardUris.add(libraryUris[li]);
    var trackId = libraryUris[li].split(':')[2];
    if (trackId) likedSet.add(trackId);
  }

  // Show signal filters + generate screen; hide loading
  document.getElementById('feed-loading').style.display = 'none';
  var filtersEl = document.getElementById('signal-filters');
  if (filtersEl) filtersEl.style.display = '';

  // Show Last.fm hint if no username or session connected
  var lfmHint = document.getElementById('generate-lfm-hint');
  if (lfmHint && !localStorage.getItem('signal_lfm_username') && !LFM_SESSION_KEY) lfmHint.style.display = '';

  document.getElementById('generate-screen').style.display = 'flex';

  // Generate button -- runs inside a user gesture so autoplay works
  document.getElementById('generate-feed-btn').addEventListener('click', async function() {
    this.disabled = true;
    document.getElementById('generate-screen').style.display = 'none';
    document.getElementById('feed').style.display = 'block';

    try {
      await loadNextBatch();
      renderFeedContext();
      autoplayFirstTrack();
    } catch (e) {
      console.error('Feed generation failed', e);
      document.getElementById('feed-empty').style.display = '';
    }

    // Start polling fallback if SDK not ready after 5s
    setTimeout(function() {
      if (!sdkReady) startPollingFallback();
    }, 5000);
  });
}

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', init);
