/**
 * Spotify Web Controls - Spotify DOM Scanner & Player Controller
 * 
 * Implements resilient multi-strategy detection for Spotify Web Player.
 * Synchronizes player state with MediaSession and Android notifications.
 */

(function () {
  'use strict';

  if (window.__SPOTIFY_PLAYER_CONTROLLER_LOADED__) return;
  window.__SPOTIFY_PLAYER_CONTROLLER_LOADED__ = true;

  const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

  // Configuration with defaults
  let config = {
    extensionEnabled: true,
    debugEnabled: true,
    seekControlsEnabled: true,
    notificationIntegrationEnabled: true
  };

  function log(...args) {
    if (config.debugEnabled) {
      console.log('[Spotify Controls:DOM]', ...args);
    }
  }

  function error(...args) {
    console.error('[Spotify Controls:DOM ERROR]', ...args);
  }

  /**
   * Resilient Multi-Strategy Selectors
   * Priority:
   * 1. Data testids
   * 2. Multilingual Aria-labels (English, Spanish, etc.)
   * 3. Structural class names & icon characteristics
   */
  const SELECTOR_STRATEGIES = {
    playerBar: [
      'footer[data-testid="now-playing-bar"]',
      '[data-testid="now-playing-bar"]',
      '.Root__now-playing-bar',
      'footer.now-playing-bar',
      'footer'
    ],
    playButton: [
      '[data-testid="control-button-play"]',
      'button[aria-label="Play" i]',
      'button[aria-label="Reproducir" i]',
      'button[aria-label*="Play" i]',
      'button[aria-label*="Reproducir" i]',
      '[data-testid="player-controls"] button[data-testid*="play"]',
      'button[title="Play" i]'
    ],
    pauseButton: [
      '[data-testid="control-button-pause"]',
      'button[aria-label="Pause" i]',
      'button[aria-label="Pausar" i]',
      'button[aria-label*="Pause" i]',
      'button[aria-label*="Pausar" i]',
      '[data-testid="player-controls"] button[data-testid*="pause"]',
      'button[title="Pause" i]'
    ],
    nextButton: [
      '[data-testid="control-button-skip-forward"]',
      'button[aria-label="Next" i]',
      'button[aria-label="Siguiente" i]',
      'button[aria-label*="Next" i]',
      'button[aria-label*="Siguiente" i]',
      'button[aria-label*="skip-forward" i]',
      'button[title="Next" i]'
    ],
    prevButton: [
      '[data-testid="control-button-skip-back"]',
      'button[aria-label="Previous" i]',
      'button[aria-label="Anterior" i]',
      'button[aria-label*="Previous" i]',
      'button[aria-label*="Anterior" i]',
      'button[aria-label*="skip-back" i]',
      'button[title="Previous" i]'
    ],
    title: [
      '[data-testid="context-item-info-title"] a',
      '[data-testid="context-item-info-title"]',
      '[data-testid="nowplaying-track-link"]',
      '[data-testid="track-info-name"]',
      '.now-playing a[data-testid="context-item-link"]',
      '.track-info__name a'
    ],
    artist: [
      '[data-testid="context-item-info-artist"] a',
      '[data-testid="context-item-info-artist"]',
      '[data-testid="context-item-info-subtitles"] a',
      '[data-testid="context-item-info-subtitles"]',
      '[data-testid="track-info-artists"] a',
      '.track-info__artists a'
    ],
    artwork: [
      '[data-testid="cover-art-image"]',
      '[data-testid="now-playing-widget"] img',
      '.cover-art-image',
      '.now-playing img'
    ],
    position: [
      '[data-testid="playback-position"]',
      '.playback-bar__progress-time:first-of-type'
    ],
    duration: [
      '[data-testid="playback-duration"]',
      '.playback-bar__progress-time:last-of-type'
    ],
    progressBar: [
      '[data-testid="playback-progressbar"] [role="slider"]',
      '[data-testid="progress-bar"] [role="slider"]',
      '.playback-progressbar [role="slider"]',
      '.progress-bar'
    ]
  };

  function findElement(selectorList, container = document) {
    for (let i = 0; i < selectorList.length; i++) {
      try {
        const el = container.querySelector(selectorList[i]);
        if (el) return el;
      } catch (e) {
        // Selector syntax ignored
      }
    }
    return null;
  }

  function parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    } else if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return 0;
  }

  // Player state cache
  let currentState = {
    spotifyDetected: true,
    playerDetected: false,
    title: '',
    artist: '',
    album: 'Spotify Web Player',
    artwork: '',
    playbackState: 'none', // 'playing' | 'paused' | 'none'
    position: 0,
    duration: 0,
    lastUpdate: 0
  };

  /**
   * Scans the Spotify DOM and extracts active playback state.
   */
  function scanPlayer() {
    const playerBar = findElement(SELECTOR_STRATEGIES.playerBar);
    const playBtn = findElement(SELECTOR_STRATEGIES.playButton);
    const pauseBtn = findElement(SELECTOR_STRATEGIES.pauseButton);

    const isDetected = Boolean(playerBar || playBtn || pauseBtn);

    let isPlaying = false;
    if (pauseBtn) {
      isPlaying = true;
    } else if (playBtn) {
      isPlaying = false;
    } else {
      // Audio element fallback
      const audio = document.querySelector('audio');
      if (audio) {
        isPlaying = !audio.paused;
      }
    }

    const titleEl = findElement(SELECTOR_STRATEGIES.title);
    const artistEl = findElement(SELECTOR_STRATEGIES.artist);
    const artEl = findElement(SELECTOR_STRATEGIES.artwork);
    const posEl = findElement(SELECTOR_STRATEGIES.position);
    const durEl = findElement(SELECTOR_STRATEGIES.duration);

    const title = titleEl ? (titleEl.textContent || '').trim() : '';
    const artist = artistEl ? (artistEl.textContent || '').trim() : '';
    const artwork = artEl ? (artEl.src || artEl.getAttribute('src') || '') : '';
    const position = posEl ? parseTimeToSeconds(posEl.textContent) : 0;
    const duration = durEl ? parseTimeToSeconds(durEl.textContent) : 0;

    const playbackState = isDetected ? (isPlaying ? 'playing' : 'paused') : 'none';

    const hasChanged = (
      currentState.playerDetected !== isDetected ||
      currentState.playbackState !== playbackState ||
      currentState.title !== title ||
      currentState.artist !== artist ||
      currentState.artwork !== artwork ||
      Math.abs(currentState.position - position) > 2 ||
      currentState.duration !== duration
    );

    const previousPlaying = currentState.playbackState === 'playing';

    currentState = {
      spotifyDetected: true,
      playerDetected: isDetected,
      title: title || (isDetected ? 'Spotify Music' : ''),
      artist: artist || (isDetected ? 'Spotify Web' : ''),
      album: 'Spotify Web Player',
      artwork: artwork,
      playbackState: playbackState,
      position: position,
      duration: duration,
      lastUpdate: Date.now()
    };

    if (hasChanged) {
      if (title && title !== currentState.lastLoggedTitle) {
        log('Track changed:', `${title} - ${artist}`);
        currentState.lastLoggedTitle = title;
      }
      if (previousPlaying !== isPlaying) {
        log('Playing state changed:', isPlaying ? 'Playing' : 'Paused');
      }

      // Sync state with MAIN-world bridge
      if (typeof window.__spotifyControlsBridgeSync === 'function') {
        window.__spotifyControlsBridgeSync(currentState);
      }
    }

    return currentState;
  }

  /**
   * Action Execution Strategies
   */
  function executeAction(actionName, details = {}) {
    log(`Executing action: ${actionName}`, details);

    switch (actionName) {
      case 'play': {
        const playBtn = findElement(SELECTOR_STRATEGIES.playButton);
        if (playBtn) {
          log('Clicking Spotify Play button');
          playBtn.click();
          scanPlayer();
          return true;
        }
        // Fallback: keyboard shortcut
        return triggerKeyboardShortcut('Space');
      }

      case 'pause': {
        const pauseBtn = findElement(SELECTOR_STRATEGIES.pauseButton);
        if (pauseBtn) {
          log('Clicking Spotify Pause button');
          pauseBtn.click();
          scanPlayer();
          return true;
        }
        // Fallback: keyboard shortcut
        return triggerKeyboardShortcut('Space');
      }

      case 'nexttrack': {
        log('Executing Spotify Next');
        const nextBtn = findElement(SELECTOR_STRATEGIES.nextButton);
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
          setTimeout(scanPlayer, 200);
          return true;
        }
        // Fallback: keyboard media key
        const sent = triggerKeyboardShortcut('MediaTrackNext');
        if (!sent) {
          log('[Spotify Controls] Action not supported: Next button unavailable and shortcut failed');
        }
        return sent;
      }

      case 'previoustrack': {
        log('Executing Spotify Previous');
        const prevBtn = findElement(SELECTOR_STRATEGIES.prevButton);
        if (prevBtn && !prevBtn.disabled) {
          prevBtn.click();
          setTimeout(scanPlayer, 200);
          return true;
        }
        // Fallback: keyboard media key
        const sent = triggerKeyboardShortcut('MediaTrackPrevious');
        if (!sent) {
          log('[Spotify Controls] Action not supported: Previous button unavailable and shortcut failed');
        }
        return sent;
      }

      case 'seekforward': {
        if (!config.seekControlsEnabled) {
          log('[Spotify Controls] Action not supported: Seek controls disabled in settings');
          return false;
        }
        const offset = (details && details.seekOffset) ? details.seekOffset : 15;
        return executeRelativeSeek(offset);
      }

      case 'seekbackward': {
        if (!config.seekControlsEnabled) {
          log('[Spotify Controls] Action not supported: Seek controls disabled in settings');
          return false;
        }
        const offset = (details && details.seekOffset) ? details.seekOffset : 15;
        return executeRelativeSeek(-offset);
      }

      case 'seekto': {
        if (!config.seekControlsEnabled) {
          log('[Spotify Controls] Action not supported: Seek controls disabled in settings');
          return false;
        }
        if (details && typeof details.seekTime === 'number') {
          return executeAbsoluteSeek(details.seekTime);
        }
        log('[Spotify Controls] Action not supported: Invalid seekTime');
        return false;
      }

      case 'stop': {
        log('Executing Spotify Stop (Pausing)');
        return executeAction('pause');
      }

      default: {
        log(`[Spotify Controls] Action not supported: ${actionName}`);
        return false;
      }
    }
  }

  function triggerKeyboardShortcut(keyName) {
    try {
      const target = document.body;
      let eventInit = { bubbles: true, cancelable: true };

      if (keyName === 'Space') {
        eventInit = { ...eventInit, key: ' ', code: 'Space', keyCode: 32 };
      } else if (keyName === 'MediaTrackNext') {
        eventInit = { ...eventInit, key: 'MediaTrackNext', code: 'MediaTrackNext' };
      } else if (keyName === 'MediaTrackPrevious') {
        eventInit = { ...eventInit, key: 'MediaTrackPrevious', code: 'MediaTrackPrevious' };
      }

      const keydown = new KeyboardEvent('keydown', eventInit);
      const keyup = new KeyboardEvent('keyup', eventInit);
      target.dispatchEvent(keydown);
      target.dispatchEvent(keyup);
      return true;
    } catch (e) {
      log('Keyboard fallback failed:', e.message);
      return false;
    }
  }

  function executeRelativeSeek(secondsOffset) {
    const currentPos = currentState.position;
    const duration = currentState.duration;
    if (duration <= 0) {
      log('[Spotify Controls] Action not supported: Track duration unknown');
      return false;
    }

    const targetPos = Math.max(0, Math.min(duration, currentPos + secondsOffset));
    return executeAbsoluteSeek(targetPos);
  }

  function executeAbsoluteSeek(targetSeconds) {
    const duration = currentState.duration;
    if (duration <= 0) {
      log('[Spotify Controls] Action not supported: Duration unavailable for seek');
      return false;
    }

    const slider = findElement(SELECTOR_STRATEGIES.progressBar);
    if (!slider) {
      log('[Spotify Controls] Action not supported: Progress bar slider not found');
      return false;
    }

    try {
      const rect = slider.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, targetSeconds / duration));
      const clientX = rect.left + (rect.width * ratio);
      const clientY = rect.top + (rect.height / 2);

      const pointerDown = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: clientX,
        clientY: clientY
      });
      const pointerUp = new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: clientX,
        clientY: clientY
      });

      slider.dispatchEvent(pointerDown);
      slider.dispatchEvent(pointerUp);
      log(`Seek applied: ${targetSeconds}s (${Math.round(ratio * 100)}%)`);
      setTimeout(scanPlayer, 200);
      return true;
    } catch (e) {
      log('[Spotify Controls] Action not supported: Failed to dispatch seek pointer events', e);
      return false;
    }
  }

  // Register controller for content script access
  window.__spotifyPlayerController = {
    executeAction: executeAction,
    getState: () => currentState,
    scanPlayer: scanPlayer
  };

  /**
   * Observer & Synchronization Engine
   * Uses MutationObserver with throttling and a low-frequency timer fallback.
   */
  let observer = null;
  let observerTimeout = null;

  function initObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    observer = new MutationObserver(() => {
      if (observerTimeout) return;
      observerTimeout = setTimeout(() => {
        observerTimeout = null;
        scanPlayer();
      }, 300); // 300ms debounce
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'src', 'disabled', 'class']
    });

    log('DOM MutationObserver initialized on document.body');
  }

  // Low-frequency heartbeat fallback (every 2.5s) to sync position during active playback
  setInterval(() => {
    if (currentState.playbackState === 'playing') {
      scanPlayer();
    }
  }, 2500);

  // Message listener for background / popup requests
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;

    if (message.action === 'GET_PLAYER_STATE') {
      scanPlayer();
      sendResponse(currentState);
      return true;
    }

    if (message.action === 'EXECUTE_ACTION') {
      const result = executeAction(message.actionName, message.details);
      sendResponse({ success: result, state: scanPlayer() });
      return true;
    }

    if (message.action === 'UPDATE_CONFIG') {
      config = { ...config, ...message.config };
      log('Updated local configuration:', config);
      sendResponse({ acknowledged: true });
      return true;
    }
  });

  // Setup initial scanning
  function init() {
    log('Spotify detected: Initializing DOM Scanner');
    scanPlayer();
    initObserver();
    log('Player detection loop running.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
