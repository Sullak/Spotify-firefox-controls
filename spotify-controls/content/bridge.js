/**
 * Spotify Web Controls - MAIN World Bridge Script
 *
 * Runs directly in the context of open.spotify.com (MAIN world).
 * This is necessary because Firefox Android's GeckoView links the native
 * Android Notification MediaSession to the page's main execution context
 * where the HTMLMediaElement/Audio pipeline lives.
 */

(function () {
  'use strict';

  if (window.__SPOTIFY_CONTROLS_BRIDGE_INITIALIZED__) {
    return;
  }
  window.__SPOTIFY_CONTROLS_BRIDGE_INITIALIZED__ = true;

  const CHANNEL = 'SPOTIFY_WEB_CONTROLS_CHANNEL';
  const SOURCE_BRIDGE = 'spotify-controls-bridge';
  const SOURCE_CONTENT = 'spotify-controls-content';
  const MEDIA_SESSION_ACTIONS = [
    'play',
    'pause',
    'nexttrack',
    'previoustrack',
    'seekforward',
    'seekbackward',
    'seekto',
    'stop'
  ];

  let debugEnabled = true;
  let seekControlsEnabled = true;
  let notificationIntegrationEnabled = true;

  const registeredHandlers = new Map();
  const mediaSessionDiagnostics = {};
  let lastCapturedMetadata = null;
  let lastPlaybackState = 'none';

  MEDIA_SESSION_ACTIONS.forEach(action => {
    mediaSessionDiagnostics[action] = {
      supported: null,
      handlerRegistered: false,
      registrationAttempts: 0,
      callbacksReceived: 0,
      lastReceivedAt: null,
      lastDetails: null,
      controllerDispatches: 0,
      lastControllerResult: null,
      lastControllerResultAt: null
    };
  });

  function log(...args) {
    if (debugEnabled) {
      console.log('[Spotify Controls:Bridge]', ...args);
    }
  }

  function error(...args) {
    console.error('[Spotify Controls:Bridge ERROR]', ...args);
  }

  function sendToContent(action, payload = {}) {
    window.postMessage({
      channel: CHANNEL,
      source: SOURCE_BRIDGE,
      action: action,
      payload: payload,
      timestamp: Date.now()
    }, '*');
  }

  function recordActionReceived(actionName, details) {
    const diagnostic = mediaSessionDiagnostics[actionName];
    if (!diagnostic) return;
    diagnostic.callbacksReceived += 1;
    diagnostic.lastReceivedAt = new Date().toISOString();
    diagnostic.lastDetails = details || {};
  }

  function recordControllerDispatch(actionName) {
    const diagnostic = mediaSessionDiagnostics[actionName];
    if (!diagnostic) return;
    diagnostic.controllerDispatches += 1;
  }

  function recordControllerResult(actionName, success) {
    const diagnostic = mediaSessionDiagnostics[actionName];
    if (!diagnostic) return;
    diagnostic.lastControllerResult = Boolean(success);
    diagnostic.lastControllerResultAt = new Date().toISOString();
  }

  /**
   * Action executor within the page context.
   * Dispatches command back to content script or attempts DOM action directly.
   */
  function handleMediaAction(actionName, details = {}) {
    log(`Action received from Android/Firefox MediaSession: ${actionName}`, details);

    // Notify content script to execute DOM action
    recordControllerDispatch(actionName);
    sendToContent('TRIGGER_PLAYER_ACTION', {
      action: actionName,
      details: details
    });

    // Also attempt page-level direct trigger for maximum responsiveness
    triggerDirectAction(actionName, details);
  }

  function triggerDirectAction(actionName, details) {
    try {
      if (actionName === 'play') {
        const audio = document.querySelector('audio');
        if (audio && audio.paused) {
          audio.play().catch(() => {});
        }
      } else if (actionName === 'pause') {
        const audio = document.querySelector('audio');
        if (audio && !audio.paused) {
          audio.pause();
        }
      }
    } catch (e) {
      log('Direct action fallback failed (expected if restricted):', e.message);
    }
  }

  /**
   * Hook into navigator.mediaSession to ensure handlers for:
   * previoustrack, nexttrack, play, pause, seekbackward, seekforward, seekto, stop
   * are ALWAYS present and cannot be cleared by Spotify's internal scripts.
   */
  function setupMediaSessionInterception() {
    if (!('mediaSession' in navigator)) {
      error('navigator.mediaSession is not supported in this browser environment');
      return;
    }

    const ms = navigator.mediaSession;
    const originalSetActionHandler = ms.setActionHandler.bind(ms);

    // Wrap setActionHandler
    ms.setActionHandler = function (action, handler) {
      const diagnostic = mediaSessionDiagnostics[action];
      if (diagnostic) {
        diagnostic.registrationAttempts += 1;
      }

      log(`Spotify page called setActionHandler('${action}', ${handler ? 'function' : 'null'})`);

      if (handler) {
        registeredHandlers.set(action, handler);
      } else {
        registeredHandlers.delete(action);
      }

      if (diagnostic) {
        diagnostic.handlerRegistered = Boolean(handler);
      }

      // If Spotify tries to nullify or we want to guarantee Android notification buttons:
      const effectiveHandler = handler || function (details) {
        handleMediaAction(action, details);
      };

      try {
        originalSetActionHandler(action, function (details) {
          if (diagnostic) {
            diagnostic.callbacksReceived += 1;
            diagnostic.lastReceivedAt = new Date().toISOString();
            diagnostic.lastDetails = details || {};
          }
          log(`MediaSession callback executed for: ${action}`);
          // If Spotify provided a handler, invoke it
          if (handler) {
            try {
              handler(details);
            } catch (err) {
              error(`Error in Spotify's original handler for ${action}:`, err);
            }
          }
          // Always ensure our extension logic also executes
          handleMediaAction(action, details);
        });
        if (diagnostic) {
          diagnostic.supported = true;
        }
      } catch (err) {
        if (diagnostic) {
          diagnostic.supported = false;
        }
        log(`Warning: Failed to set handler for action '${action}':`, err.message);
      }
    };

    // Forcefully register all mandatory actions right away
    MEDIA_SESSION_ACTIONS.forEach(action => {
      try {
        originalSetActionHandler(action, function (details) {
          const diagnostic = mediaSessionDiagnostics[action];
          if (diagnostic) {
            diagnostic.callbacksReceived += 1;
            diagnostic.lastReceivedAt = new Date().toISOString();
            diagnostic.lastDetails = details || {};
          }
          handleMediaAction(action, details);
        });
        mediaSessionDiagnostics[action].supported = true;
        mediaSessionDiagnostics[action].handlerRegistered = true;
        mediaSessionDiagnostics[action].registrationAttempts += 1;
        log(`Registered persistent handler for: ${action}`);
      } catch (err) {
        mediaSessionDiagnostics[action].supported = false;
        mediaSessionDiagnostics[action].handlerRegistered = false;
        mediaSessionDiagnostics[action].registrationAttempts += 1;
        log(`Could not register initial handler for '${action}':`, err.message);
      }
    });

    log('Media Session interception and persistent handlers initialized.');
  }

  /**
   * Updates MediaSession metadata and playback state directly in MAIN world.
   */
  function syncMediaSession(data) {
    if (!('mediaSession' in navigator) || !notificationIntegrationEnabled) {
      return;
    }

    try {
      const ms = navigator.mediaSession;

      // Update Playback State
      if (data.playbackState && data.playbackState !== lastPlaybackState) {
        ms.playbackState = data.playbackState;
        lastPlaybackState = data.playbackState;
        log(`Updated mediaSession.playbackState to: ${data.playbackState}`);
      }

      // Update Metadata
      if (data.title && (
        !lastCapturedMetadata ||
        lastCapturedMetadata.title !== data.title ||
        lastCapturedMetadata.artist !== data.artist ||
        lastCapturedMetadata.artwork !== data.artwork
      )) {
        const artworkArray = [];
        if (data.artwork) {
          artworkArray.push({
            src: data.artwork,
            sizes: '512x512',
            type: 'image/jpeg'
          });
          artworkArray.push({
            src: data.artwork,
            sizes: '192x192',
            type: 'image/jpeg'
          });
        }

        if (typeof window.MediaMetadata !== 'undefined') {
          ms.metadata = new window.MediaMetadata({
            title: data.title || 'Spotify Track',
            artist: data.artist || 'Unknown Artist',
            album: data.album || 'Spotify Web Player',
            artwork: artworkArray
          });
          lastCapturedMetadata = {
            title: data.title,
            artist: data.artist,
            album: data.album,
            artwork: data.artwork
          };
          log('Updated mediaSession.metadata:', lastCapturedMetadata);
        }
      }

      // Update Position State (Position & Duration)
      if (
        typeof ms.setPositionState === 'function' &&
        data.duration > 0 &&
        data.position >= 0 &&
        data.position <= data.duration
      ) {
        try {
          ms.setPositionState({
            duration: Math.max(1, data.duration),
            playbackRate: 1.0,
            position: Math.min(data.position, data.duration)
          });
        } catch (e) {
          // setPositionState throws if position > duration or invalid
        }
      }
    } catch (err) {
      error('Failed to sync MediaSession in bridge:', err);
    }
  }

  /**
   * Listen for messages from content script (isolated world)
   */
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.channel !== CHANNEL) {
      return;
    }

    if (event.data.source !== SOURCE_CONTENT) {
      return;
    }

    const { action, payload } = event.data;

    switch (action) {
      case 'SYNC_STATE':
        syncMediaSession(payload);
        break;

      case 'CONTROLLER_RESULT':
        recordControllerResult(payload.action, payload.success);
        log(`Spotify controller result: ${payload.action} => ${payload.success ? 'success' : 'failed'}`);
        break;

      case 'UPDATE_CONFIG':
        if (payload.debugEnabled !== undefined) debugEnabled = payload.debugEnabled;
        if (payload.seekControlsEnabled !== undefined) seekControlsEnabled = payload.seekControlsEnabled;
        if (payload.notificationIntegrationEnabled !== undefined) {
          notificationIntegrationEnabled = payload.notificationIntegrationEnabled;
        }
        log('Configuration updated in bridge:', payload);
        break;

      default:
        break;
    }
  });

  // Diagnostic tool accessible from the browser console (about:debugging or Firefox Remote DevTools)
  window.__spotifyControlsDebug = function () {
    const msAvailable = 'mediaSession' in navigator;
    const audioElements = Array.from(document.querySelectorAll('audio')).map(a => ({
      paused: a.paused,
      currentTime: a.currentTime,
      duration: a.duration,
      readyState: a.readyState,
      muted: a.muted,
      src: a.src ? (a.src.substring(0, 30) + '...') : '(empty/blob)'
    }));

    const findButton = (selectors) => {
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            return {
              found: true,
              disabled: Boolean(element.disabled),
              ariaLabel: element.getAttribute('aria-label'),
              title: element.getAttribute('title'),
              testId: element.getAttribute('data-testid')
            };
          }
        } catch (e) {}
      }
      return { found: false };
    };

    const spotifyControls = {
      nextButton: findButton([
        '[data-testid="control-button-skip-forward"]',
        'button[aria-label="Next" i]',
        'button[aria-label="Siguiente" i]',
        'button[aria-label*="Next" i]',
        'button[aria-label*="Siguiente" i]',
        'button[title="Next" i]'
      ]),
      previousButton: findButton([
        '[data-testid="control-button-skip-back"]',
        'button[aria-label="Previous" i]',
        'button[aria-label="Anterior" i]',
        'button[aria-label*="Previous" i]',
        'button[aria-label*="Anterior" i]',
        'button[title="Previous" i]'
      ])
    };

    return {
      name: 'Spotify Web Controls (Bridge Diagnostic)',
      timestamp: new Date().toISOString(),
      spotifyDetected: window.location.hostname.includes('spotify.com'),
      mediaSessionAvailable: msAvailable,
      mediaSession: msAvailable ? {
        playbackState: navigator.mediaSession.playbackState,
        supportedActions: MEDIA_SESSION_ACTIONS.reduce((result, action) => {
          result[action] = mediaSessionDiagnostics[action].supported;
          return result;
        }, {}),
        actions: JSON.parse(JSON.stringify(mediaSessionDiagnostics))
      } : null,
      currentMetadata: lastCapturedMetadata,
      audio: {
        count: audioElements.length,
        elements: audioElements
      },
      spotifyControls,
      activeHandlers: Array.from(registeredHandlers.keys()),
      config: {
        debugEnabled,
        seekControlsEnabled,
        notificationIntegrationEnabled
      }
    };
  };

  setupMediaSessionInterception();
})();
