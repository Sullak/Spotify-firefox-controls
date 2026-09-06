/**
 * Spotify Web Controls - Content Script Coordinator (Isolated World)
 * 
 * Injects bridge.js into the MAIN world and facilitates bidirectional communication
 * between the isolated WebExtension world and the page context.
 */

(function () {
  'use strict';

  if (window.__SPOTIFY_MEDIA_SESSION_LOADED__) return;
  window.__SPOTIFY_MEDIA_SESSION_LOADED__ = true;

  const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
  const CHANNEL = 'SPOTIFY_WEB_CONTROLS_CHANNEL';
  const SOURCE_CONTENT = 'spotify-controls-content';
  const SOURCE_BRIDGE = 'spotify-controls-bridge';

  let config = {
    extensionEnabled: true,
    debugEnabled: true,
    seekControlsEnabled: true,
    notificationIntegrationEnabled: true
  };

  function log(...args) {
    if (config.debugEnabled) {
      console.log('[Spotify Controls:MediaSession]', ...args);
    }
  }

  // Load configuration from extension storage
  if (browserAPI.storage && browserAPI.storage.local) {
    browserAPI.storage.local.get({
      extensionEnabled: true,
      debugEnabled: true,
      seekControlsEnabled: true,
      notificationIntegrationEnabled: true
    }, (items) => {
      config = items;
      sendToBridge('UPDATE_CONFIG', config);
      log('Loaded stored configuration:', config);
    });

    // Listen for options changes
    if (browserAPI.storage.onChanged) {
      browserAPI.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          for (let key in changes) {
            config[key] = changes[key].newValue;
          }
          sendToBridge('UPDATE_CONFIG', config);
          log('Config updated from storage event:', config);
        }
      });
    }
  }

  function sendToBridge(action, payload = {}) {
    window.postMessage({
      channel: CHANNEL,
      source: SOURCE_CONTENT,
      action: action,
      payload: payload,
      timestamp: Date.now()
    }, '*');
  }

  /**
   * Injects the bridge script into the page's MAIN execution world.
   */
  function injectBridge() {
    try {
      const script = document.createElement('script');
      script.src = browserAPI.runtime.getURL('content/bridge.js');
      script.async = false;
      script.onload = function () {
        log('Bridge script injected and loaded.');
        this.remove(); // Clean up DOM tag, script execution remains
      };
      script.onerror = function (e) {
        console.error('[Spotify Controls] Failed to load bridge script:', e);
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[Spotify Controls] Error during bridge injection:', e);
    }
  }

  // Forward messages from bridge (MAIN world) to Spotify controller or Background
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.channel !== CHANNEL) {
      return;
    }

    if (event.data.source !== SOURCE_BRIDGE) {
      return;
    }

    const { action, payload } = event.data;

    switch (action) {
      case 'BRIDGE_READY':
        log('Bridge announced readiness.');
        sendToBridge('UPDATE_CONFIG', config);
        break;

      case 'TRIGGER_PLAYER_ACTION':
        log(`Action triggered from bridge: ${payload.action}`);
        if (window.__spotifyPlayerController && typeof window.__spotifyPlayerController.executeAction === 'function') {
          window.__spotifyPlayerController.executeAction(payload.action, payload.details);
        } else {
          log('[Spotify Controls] Action not supported or player controller not ready:', payload.action);
        }
        break;

      default:
        break;
    }
  });

  // Export API for spotify.js to send state to bridge
  window.__spotifyControlsBridgeSync = function (playerState) {
    sendToBridge('SYNC_STATE', playerState);
  };

  // Inject early
  if (document.head || document.documentElement) {
    injectBridge();
  } else {
    document.addEventListener('DOMContentLoaded', injectBridge, { once: true });
  }
})();
