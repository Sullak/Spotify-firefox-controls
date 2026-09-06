/**
 * Spotify Web Controls - Popup Logic
 * 
 * Interacts with background script to query status and issue commands.
 */

(function () {
  'use strict';

  const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

  // DOM Elements
  const statusBullet = document.getElementById('status-bullet');
  const statusText = document.getElementById('status-text');
  const msStatus = document.getElementById('ms-status');
  const playerView = document.getElementById('player-view');
  const noPlayerView = document.getElementById('no-player-view');
  const trackArt = document.getElementById('track-art');
  const trackTitle = document.getElementById('track-title');
  const trackArtist = document.getElementById('track-artist');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const btnPrev = document.getElementById('btn-prev');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnNext = document.getElementById('btn-next');
  const btnSeekBack = document.getElementById('btn-seek-back');
  const btnSeekFwd = document.getElementById('btn-seek-fwd');
  const btnOptions = document.getElementById('btn-options');
  const btnRefresh = document.getElementById('btn-refresh');

  let currentPlayingState = false;

  function updateUI(response) {
    if (!response || !response.connected || !response.state) {
      statusBullet.className = 'bullet disconnected';
      statusText.textContent = '○ Spotify not detected';
      msStatus.textContent = 'Not available';
      msStatus.className = 'ms-inactive';
      playerView.classList.add('hidden');
      noPlayerView.classList.remove('hidden');
      return;
    }

    const state = response.state;

    // Connected state
    statusBullet.className = 'bullet connected';
    statusText.textContent = '● Connected';

    // Media Session indicator
    msStatus.textContent = 'Active';
    msStatus.className = 'ms-active';

    if (state.playerDetected) {
      playerView.classList.remove('hidden');
      noPlayerView.classList.add('hidden');

      trackTitle.textContent = state.title || 'Unknown Track';
      trackArtist.textContent = state.artist || 'Unknown Artist';

      if (state.artwork) {
        trackArt.src = state.artwork;
      } else {
        trackArt.src = '../icons/icon-96.png';
      }

      currentPlayingState = (state.playbackState === 'playing');
      if (currentPlayingState) {
        playIcon.textContent = '⏸';
        playText.textContent = 'Pause';
      } else {
        playIcon.textContent = '▶';
        playText.textContent = 'Play';
      }
    } else {
      playerView.classList.add('hidden');
      noPlayerView.classList.remove('hidden');
    }
  }

  function fetchStatus() {
    browserAPI.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (browserAPI.runtime.lastError) {
        updateUI(null);
      } else {
        updateUI(response);
      }
    });
  }

  function sendCommand(actionName, details = {}) {
    browserAPI.runtime.sendMessage({
      type: 'COMMAND',
      actionName: actionName,
      details: details
    }, (res) => {
      // Refresh status after command execution
      setTimeout(fetchStatus, 300);
    });
  }

  // Button Listeners
  btnPlayPause.addEventListener('click', () => {
    const action = currentPlayingState ? 'pause' : 'play';
    sendCommand(action);
  });

  btnPrev.addEventListener('click', () => {
    sendCommand('previoustrack');
  });

  btnNext.addEventListener('click', () => {
    sendCommand('nexttrack');
  });

  btnSeekBack.addEventListener('click', () => {
    sendCommand('seekbackward', { seekOffset: 15 });
  });

  btnSeekFwd.addEventListener('click', () => {
    sendCommand('seekforward', { seekOffset: 15 });
  });

  btnRefresh.addEventListener('click', () => {
    fetchStatus();
  });

  btnOptions.addEventListener('click', (e) => {
    e.preventDefault();
    if (browserAPI.runtime.openOptionsPage) {
      browserAPI.runtime.openOptionsPage();
    } else {
      window.open(browserAPI.runtime.getURL('options/options.html'));
    }
  });

  // Initial call and periodic poll while popup is open
  fetchStatus();
  const pollTimer = setInterval(fetchStatus, 2000);

  window.addEventListener('unload', () => {
    clearInterval(pollTimer);
  });
})();
