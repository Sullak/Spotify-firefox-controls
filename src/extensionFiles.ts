/**
 * Extension source files registry for live inspection and zip packaging.
 */

export interface ExtensionFile {
  path: string;
  filename: string;
  category: 'manifest' | 'content' | 'background' | 'popup' | 'options' | 'docs';
  content: string;
  description: string;
}

export const EXTENSION_FILES: ExtensionFile[] = [
  {
    path: 'manifest.json',
    filename: 'manifest.json',
    category: 'manifest',
    description: 'Manifest V3 configuration for Firefox Android (MV2 also supported)',
    content: `{
  "manifest_version": 3,
  "name": "Spotify Web Controls (Firefox Android)",
  "version": "1.0.0",
  "description": "Exposes Previous, Next, Seek, and Play/Pause to Android media notifications from Spotify Web Player.",
  "author": "Spotify Web Controls Project",
  "browser_specific_settings": {
    "gecko": {
      "id": "spotify-web-controls@firefox-android.local",
      "strict_min_version": "109.0"
    }
  },
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://open.spotify.com/*"
  ],
  "background": {
    "scripts": ["background/background.js"]
  },
  "content_scripts": [
    {
      "matches": [
        "https://open.spotify.com/*"
      ],
      "js": [
        "content/media-session.js",
        "content/spotify.js"
      ],
      "run_at": "document_start"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "content/bridge.js",
        "icons/icon-48.png",
        "icons/icon-96.png",
        "icons/icon-128.png"
      ],
      "matches": [
        "https://open.spotify.com/*"
      ]
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Spotify Web Controls",
    "default_icon": {
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "icons": {
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png",
    "128": "icons/icon-128.png"
  }
}`
  },
  {
    path: 'manifest.v2.json',
    filename: 'manifest.v2.json',
    category: 'manifest',
    description: 'Alternative Manifest V2 for older Firefox Android builds (<109)',
    content: `{
  "manifest_version": 2,
  "name": "Spotify Web Controls (Firefox Android)",
  "version": "1.0.0",
  "description": "Exposes Previous, Next, Seek, and Play/Pause to Android media notifications from Spotify Web Player.",
  "browser_specific_settings": {
    "gecko": {
      "id": "spotify-web-controls@firefox-android.local",
      "strict_min_version": "68.0"
    }
  },
  "permissions": [
    "storage",
    "tabs",
    "https://open.spotify.com/*"
  ],
  "background": {
    "scripts": ["background/background.js"],
    "persistent": false
  },
  "content_scripts": [
    {
      "matches": [
        "https://open.spotify.com/*"
      ],
      "js": [
        "content/media-session.js",
        "content/spotify.js"
      ],
      "run_at": "document_start"
    }
  ],
  "web_accessible_resources": [
    "content/bridge.js",
    "icons/icon-48.png",
    "icons/icon-96.png",
    "icons/icon-128.png"
  ],
  "browser_action": {
    "default_popup": "popup/popup.html",
    "default_title": "Spotify Web Controls",
    "default_icon": {
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "icons": {
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png",
    "128": "icons/icon-128.png"
  }
}`
  },
  {
    path: 'content/bridge.js',
    filename: 'bridge.js',
    category: 'content',
    description: 'Executes in the MAIN page world; hooks navigator.mediaSession and sets persistent handlers',
    content: `/**
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

  let debugEnabled = true;
  let seekControlsEnabled = true;
  let notificationIntegrationEnabled = true;

  const registeredHandlers = new Map();
  let lastCapturedMetadata = null;
  let lastPlaybackState = 'none';

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

  function handleMediaAction(actionName, details = {}) {
    log(\`Action received from Android/Firefox MediaSession: \${actionName}\`, details);
    
    sendToContent('TRIGGER_PLAYER_ACTION', {
      action: actionName,
      details: details
    });

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

  function setupMediaSessionInterception() {
    if (!('mediaSession' in navigator)) {
      error('navigator.mediaSession is not supported in this browser environment');
      return;
    }

    const ms = navigator.mediaSession;
    const originalSetActionHandler = ms.setActionHandler.bind(ms);

    const MANDATORY_ACTIONS = [
      'play',
      'pause',
      'previoustrack',
      'nexttrack',
      'seekbackward',
      'seekforward',
      'seekto',
      'stop'
    ];

    ms.setActionHandler = function (action, handler) {
      log(\`Spotify page called setActionHandler('\${action}', \${handler ? 'function' : 'null'})\`);
      
      if (handler) {
        registeredHandlers.set(action, handler);
      } else {
        registeredHandlers.delete(action);
      }

      try {
        originalSetActionHandler(action, function (details) {
          log(\`MediaSession callback executed for: \${action}\`);
          if (handler) {
            try {
              handler(details);
            } catch (err) {
              error(\`Error in Spotify's original handler for \${action}:\`, err);
            }
          }
          handleMediaAction(action, details);
        });
      } catch (err) {
        log(\`Warning: Failed to set handler for action '\${action}':\`, err.message);
      }
    };

    MANDATORY_ACTIONS.forEach(action => {
      try {
        originalSetActionHandler(action, function (details) {
          handleMediaAction(action, details);
        });
        log(\`Registered persistent handler for: \${action}\`);
      } catch (err) {
        log(\`Could not register initial handler for '\${action}':\`, err.message);
      }
    });

    log('Media Session interception and persistent handlers initialized.');
  }

  function syncMediaSession(data) {
    if (!('mediaSession' in navigator) || !notificationIntegrationEnabled) {
      return;
    }

    try {
      const ms = navigator.mediaSession;

      if (data.playbackState && data.playbackState !== lastPlaybackState) {
        ms.playbackState = data.playbackState;
        lastPlaybackState = data.playbackState;
        log(\`Updated mediaSession.playbackState to: \${data.playbackState}\`);
      }

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
        } catch (e) {}
      }
    } catch (err) {
      error('Failed to sync MediaSession in bridge:', err);
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.channel !== CHANNEL) return;
    if (event.data.source !== SOURCE_CONTENT) return;

    const { action, payload } = event.data;
    switch (action) {
      case 'SYNC_STATE':
        syncMediaSession(payload);
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

  window.__spotifyControlsDebug = function () {
    const msAvailable = 'mediaSession' in navigator;
    const audioElements = Array.from(document.querySelectorAll('audio')).map(a => ({
      paused: a.paused,
      currentTime: a.currentTime,
      duration: a.duration,
      muted: a.muted
    }));

    return {
      name: 'Spotify Web Controls (Bridge Diagnostic)',
      timestamp: new Date().toISOString(),
      spotifyDetected: window.location.hostname.includes('spotify.com'),
      mediaSessionAvailable: msAvailable,
      playbackState: msAvailable ? navigator.mediaSession.playbackState : 'N/A',
      currentMetadata: lastCapturedMetadata,
      audioElementsCount: audioElements.length,
      activeHandlers: Array.from(registeredHandlers.keys()),
      supportedActions: ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto', 'stop'],
      config: { debugEnabled, seekControlsEnabled, notificationIntegrationEnabled }
    };
  };

  setupMediaSessionInterception();
  sendToContent('BRIDGE_READY', { initialized: true });
})();`
  },
  {
    path: 'content/media-session.js',
    filename: 'media-session.js',
    category: 'content',
    description: 'Content script coordinator in isolated world: injects bridge.js and manages secure messaging',
    content: `/**
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

  function injectBridge() {
    try {
      const script = document.createElement('script');
      script.src = browserAPI.runtime.getURL('content/bridge.js');
      script.async = false;
      script.onload = function () {
        log('Bridge script injected and loaded.');
        this.remove();
      };
      script.onerror = function (e) {
        console.error('[Spotify Controls] Failed to load bridge script:', e);
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[Spotify Controls] Error during bridge injection:', e);
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.channel !== CHANNEL) return;
    if (event.data.source !== SOURCE_BRIDGE) return;

    const { action, payload } = event.data;
    switch (action) {
      case 'BRIDGE_READY':
        log('Bridge announced readiness.');
        sendToBridge('UPDATE_CONFIG', config);
        break;
      case 'TRIGGER_PLAYER_ACTION':
        log(\`Action triggered from bridge: \${payload.action}\`);
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

  window.__spotifyControlsBridgeSync = function (playerState) {
    sendToBridge('SYNC_STATE', playerState);
  };

  if (document.head || document.documentElement) {
    injectBridge();
  } else {
    document.addEventListener('DOMContentLoaded', injectBridge, { once: true });
  }
})();`
  },
  {
    path: 'content/spotify.js',
    filename: 'spotify.js',
    category: 'content',
    description: 'Resilient multi-strategy DOM scanner, MutationObserver, and action executor for Spotify Web Player',
    content: `/**
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
      } catch (e) {}
    }
    return null;
  }

  function parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    return 0;
  }

  let currentState = {
    spotifyDetected: true,
    playerDetected: false,
    title: '',
    artist: '',
    album: 'Spotify Web Player',
    artwork: '',
    playbackState: 'none',
    position: 0,
    duration: 0,
    lastUpdate: 0
  };

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
      const audio = document.querySelector('audio');
      if (audio) isPlaying = !audio.paused;
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
        log('Track changed:', \`\${title} - \${artist}\`);
        currentState.lastLoggedTitle = title;
      }
      if (previousPlaying !== isPlaying) {
        log('Playing state changed:', isPlaying ? 'Playing' : 'Paused');
      }

      if (typeof window.__spotifyControlsBridgeSync === 'function') {
        window.__spotifyControlsBridgeSync(currentState);
      }
    }

    return currentState;
  }

  function executeAction(actionName, details = {}) {
    log(\`Executing action: \${actionName}\`, details);

    switch (actionName) {
      case 'play': {
        const playBtn = findElement(SELECTOR_STRATEGIES.playButton);
        if (playBtn) {
          log('Clicking Spotify Play button');
          playBtn.click();
          scanPlayer();
          return true;
        }
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
        log(\`[Spotify Controls] Action not supported: \${actionName}\`);
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
      target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
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

      const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX, clientY });
      const pointerUp = new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX, clientY });
      slider.dispatchEvent(pointerDown);
      slider.dispatchEvent(pointerUp);
      log(\`Seek applied: \${targetSeconds}s (\${Math.round(ratio * 100)}%)\`);
      setTimeout(scanPlayer, 200);
      return true;
    } catch (e) {
      log('[Spotify Controls] Action not supported: Failed to dispatch seek pointer events', e);
      return false;
    }
  }

  window.__spotifyPlayerController = {
    executeAction: executeAction,
    getState: () => currentState,
    scanPlayer: scanPlayer
  };

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
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'src', 'disabled', 'class']
    });

    log('DOM MutationObserver initialized on document.body');
  }

  setInterval(() => {
    if (currentState.playbackState === 'playing') scanPlayer();
  }, 2500);

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

  function init() {
    log('Spotify detected: Initializing DOM Scanner');
    scanPlayer();
    initObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();`
  },
  {
    path: 'background/background.js',
    filename: 'background.js',
    category: 'background',
    description: 'Background coordinator: connects popup, options, and tabs, handles settings persistence',
    content: `/**
 * Spotify Web Controls - WebExtension Background Script
 * 
 * Coordinates communication between Popup, Options, and Spotify content scripts.
 * Manages tab targeting and configuration storage.
 */

const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const DEFAULT_CONFIG = {
  extensionEnabled: true,
  debugEnabled: true,
  seekControlsEnabled: true,
  notificationIntegrationEnabled: true
};

function log(...args) {
  browserAPI.storage.local.get('debugEnabled', (res) => {
    if (res && res.debugEnabled !== false) {
      console.log('[Spotify Controls:Background]', ...args);
    }
  });
}

browserAPI.runtime.onInstalled.addListener(() => {
  browserAPI.storage.local.get(null, (existing) => {
    const updated = { ...DEFAULT_CONFIG, ...existing };
    browserAPI.storage.local.set(updated, () => {
      log('Default configuration initialized:', updated);
    });
  });
});

async function getSpotifyTab() {
  return new Promise((resolve) => {
    browserAPI.tabs.query({ url: '*://open.spotify.com/*' }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      const activeOrAudible = tabs.find(t => t.active || t.audible);
      resolve(activeOrAudible || tabs[0]);
    });
  });
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  log(\`Message received: \${message.type}\`, message);

  if (message.type === 'GET_STATUS') {
    getSpotifyTab().then((tab) => {
      if (!tab) {
        sendResponse({
          connected: false,
          reason: 'No open.spotify.com tab found'
        });
        return;
      }

      browserAPI.tabs.sendMessage(tab.id, { action: 'GET_PLAYER_STATE' }, (stateResponse) => {
        if (browserAPI.runtime.lastError || !stateResponse) {
          sendResponse({
            connected: false,
            tabId: tab.id,
            reason: 'Spotify tab open, but content script not yet ready or loaded'
          });
        } else {
          sendResponse({
            connected: true,
            tabId: tab.id,
            state: stateResponse
          });
        }
      });
    });
    return true;
  }

  if (message.type === 'COMMAND') {
    getSpotifyTab().then((tab) => {
      if (!tab) {
        sendResponse({ success: false, error: 'Spotify tab not found' });
        return;
      }

      browserAPI.tabs.sendMessage(
        tab.id,
        {
          action: 'EXECUTE_ACTION',
          actionName: message.actionName,
          details: message.details || {}
        },
        (execResponse) => {
          if (browserAPI.runtime.lastError) {
            sendResponse({ success: false, error: browserAPI.runtime.lastError.message });
          } else {
            sendResponse(execResponse || { success: true });
          }
        }
      );
    });
    return true;
  }

  if (message.type === 'UPDATE_CONFIG') {
    browserAPI.storage.local.set(message.config, () => {
      browserAPI.tabs.query({ url: '*://open.spotify.com/*' }, (tabs) => {
        if (tabs) {
          tabs.forEach(tab => {
            browserAPI.tabs.sendMessage(tab.id, {
              action: 'UPDATE_CONFIG',
              config: message.config
            }, () => {
              if (browserAPI.runtime.lastError) {}
            });
          });
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }
});`
  },
  {
    path: 'popup/popup.html',
    filename: 'popup.html',
    category: 'popup',
    description: 'Compact popup interface: shows connection status, track info, Play/Pause, Previous, Next, Seek',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Controls</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header class="header">
      <div class="logo-title">
        <span class="icon-dot"></span>
        <h1>Spotify Controls</h1>
      </div>
      <a href="#" id="btn-options" class="settings-link" title="Open Settings">⚙️</a>
    </header>

    <div id="status-card" class="status-card">
      <div class="status-indicator">
        <span id="status-bullet" class="bullet disconnected"></span>
        <span id="status-text" class="status-text">Connecting...</span>
      </div>
      <div class="media-session-tag">
        Media Session: <span id="ms-status" class="ms-inactive">Checking...</span>
      </div>
    </div>

    <div id="player-view" class="player-view hidden">
      <div class="track-header">
        <img id="track-art" class="track-art" src="../icons/icon-96.png" alt="Cover">
        <div class="track-info">
          <div class="info-row">
            <span class="label">Song:</span>
            <span id="track-title" class="val title">—</span>
          </div>
          <div class="info-row">
            <span class="label">Artist:</span>
            <span id="track-artist" class="val artist">—</span>
          </div>
        </div>
      </div>

      <div class="controls-grid">
        <button id="btn-prev" class="ctrl-btn" title="Previous Track">
          <span class="btn-icon">⏮</span>
          <span>Previous</span>
        </button>
        <button id="btn-play-pause" class="ctrl-btn primary" title="Play or Pause">
          <span id="play-icon" class="btn-icon">⏯</span>
          <span id="play-text">Play/Pause</span>
        </button>
        <button id="btn-next" class="ctrl-btn" title="Next Track">
          <span class="btn-icon">⏭</span>
          <span>Next</span>
        </button>
      </div>

      <div class="seek-grid">
        <button id="btn-seek-back" class="seek-btn" title="Rewind 15 seconds">
          <span>-15s</span>
        </button>
        <button id="btn-seek-fwd" class="seek-btn" title="Fast forward 15 seconds">
          <span>+15s</span>
        </button>
      </div>
    </div>

    <div id="no-player-view" class="no-player-view">
      <p>Open <a href="https://open.spotify.com/" target="_blank">open.spotify.com</a> in a tab and start audio playback to activate controls.</p>
    </div>

    <footer class="footer">
      <span id="footer-tab-info">Firefox Android Extension</span>
      <button id="btn-refresh" class="refresh-btn" title="Refresh state">↻</button>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>`
  },
  {
    path: 'popup/popup.css',
    filename: 'popup.css',
    category: 'popup',
    description: 'Dark mode styling conforming to Spotify aesthetic',
    content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #121212;
  color: #FFFFFF;
  width: 320px;
  min-height: 380px;
  padding: 14px;
}
.popup-container { display: flex; flex-direction: column; gap: 12px; }
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #282828; padding-bottom: 8px; }
.logo-title { display: flex; align-items: center; gap: 8px; }
.icon-dot { width: 10px; height: 10px; background-color: #1DB954; border-radius: 50%; display: inline-block; }
.header h1 { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
.settings-link { text-decoration: none; font-size: 16px; opacity: 0.8; transition: opacity 0.2s; }
.settings-link:hover { opacity: 1; }
.status-card { background-color: #181818; border: 1px solid #282828; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.status-indicator { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.bullet { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.bullet.connected { background-color: #1DB954; box-shadow: 0 0 6px rgba(29, 185, 84, 0.6); }
.bullet.disconnected { background-color: #B3B3B3; box-shadow: none; }
.media-session-tag { font-size: 11px; color: #B3B3B3; }
.ms-active { color: #1DB954; font-weight: 600; }
.ms-inactive { color: #A7A7A7; font-weight: 500; }
.player-view { background-color: #181818; border: 1px solid #282828; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.hidden { display: none !important; }
.track-header { display: flex; gap: 12px; align-items: center; }
.track-art { width: 52px; height: 52px; border-radius: 6px; object-fit: cover; background-color: #282828; flex-shrink: 0; }
.track-info { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.info-row { display: flex; gap: 6px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.info-row .label { color: #B3B3B3; font-size: 12px; }
.info-row .val { color: #FFFFFF; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.controls-grid { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 8px; }
.ctrl-btn { background-color: #282828; border: 1px solid #3E3E3E; border-radius: 6px; color: #FFFFFF; padding: 8px 6px; font-size: 12px; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: background-color 0.15s, transform 0.1s; }
.ctrl-btn:hover { background-color: #383838; }
.ctrl-btn:active { transform: scale(0.97); }
.ctrl-btn.primary { background-color: #1DB954; color: #000000; border-color: #1DB954; }
.ctrl-btn.primary:hover { background-color: #1ED760; }
.btn-icon { font-size: 14px; }
.seek-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.seek-btn { background-color: #242424; border: 1px solid #333333; border-radius: 6px; color: #E0E0E0; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background-color 0.15s; }
.seek-btn:hover { background-color: #333333; }
.no-player-view { background-color: #181818; border: 1px dashed #333333; border-radius: 8px; padding: 16px; text-align: center; font-size: 12px; color: #B3B3B3; line-height: 1.5; }
.no-player-view a { color: #1DB954; text-decoration: none; }
.footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #727272; padding-top: 4px; }
.refresh-btn { background: transparent; border: none; color: #B3B3B3; font-size: 15px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.refresh-btn:hover { color: #FFFFFF; background-color: #282828; }`
  },
  {
    path: 'popup/popup.js',
    filename: 'popup.js',
    category: 'popup',
    description: 'Popup controller: queries background status and executes commands',
    content: `/**
 * Spotify Web Controls - Popup Logic
 * 
 * Interacts with background script to query status and issue commands.
 */

(function () {
  'use strict';

  const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

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
    statusBullet.className = 'bullet connected';
    statusText.textContent = '● Connected';
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
    }, () => {
      setTimeout(fetchStatus, 300);
    });
  }

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

  fetchStatus();
  const pollTimer = setInterval(fetchStatus, 2000);
  window.addEventListener('unload', () => clearInterval(pollTimer));
})();`
  },
  {
    path: 'options/options.html',
    filename: 'options.html',
    category: 'options',
    description: 'Options page: configure extension, debug logging, seek controls, and notifications',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Web Controls - Settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="options-container">
    <header class="header">
      <div class="brand">
        <div class="logo-circle"></div>
        <div>
          <h1>Spotify Web Controls</h1>
          <p class="subtitle">Firefox Android Media Integration Settings</p>
        </div>
      </div>
      <span class="version-badge">v1.0.0</span>
    </header>

    <main class="settings-card">
      <section class="section">
        <h2>General Integration</h2>
        <div class="option-row">
          <div class="option-info">
            <label for="opt-extension-enabled" class="option-title">Enable extension</label>
            <p class="option-desc">Enables DOM scanning, player control, and background communication.</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="opt-extension-enabled">
            <span class="slider"></span>
          </label>
        </div>

        <div class="option-row">
          <div class="option-info">
            <label for="opt-notification" class="option-title">Enable notification integration</label>
            <p class="option-desc">Synchronizes track metadata and buttons with Android MediaSession and lock-screen widget.</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="opt-notification">
            <span class="slider"></span>
          </label>
        </div>
      </section>

      <section class="section">
        <h2>Playback Capabilities</h2>
        <div class="option-row">
          <div class="option-info">
            <label for="opt-seek" class="option-title">Enable seek controls</label>
            <p class="option-desc">Permits forward and backward seeking (+15s / -15s) and position scrubbing via Spotify's progress slider.</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="opt-seek">
            <span class="slider"></span>
          </label>
        </div>
      </section>

      <section class="section">
        <h2>Developer & Diagnostics</h2>
        <div class="option-row">
          <div class="option-info">
            <label for="opt-debug" class="option-title">Enable debug logging</label>
            <p class="option-desc">Outputs detailed <code>[Spotify Controls]</code> telemetry to WebIDE / Remote DevTools console. Contains zero sensitive data.</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="opt-debug">
            <span class="slider"></span>
          </label>
        </div>
      </section>

      <div class="actions-bar">
        <button id="btn-save" class="btn-primary">Save Settings</button>
        <span id="save-status" class="save-status"></span>
      </div>
    </main>

    <section class="diagnostic-box">
      <h3>Remote Debug Helper</h3>
      <p>To inspect real-time state from your computer via USB or Wi-Fi remote debugging:</p>
      <ol>
        <li>Navigate to <code>about:debugging</code> in Firefox Desktop.</li>
        <li>Connect Firefox Android and inspect the <code>open.spotify.com</code> tab.</li>
        <li>Run <code>window.__spotifyControlsDebug()</code> in the console.</li>
      </ol>
      <button id="btn-run-local-diag" class="btn-secondary">Check Background Status</button>
      <pre id="diag-output" class="diag-output hidden"></pre>
    </section>
  </div>

  <script src="options.js"></script>
</body>
</html>`
  },
  {
    path: 'options/options.css',
    filename: 'options.css',
    category: 'options',
    description: 'Options page styling',
    content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #121212;
  color: #FFFFFF;
  line-height: 1.5;
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}
.options-container { width: 100%; max-width: 580px; display: flex; flex-direction: column; gap: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; align-items: center; gap: 12px; }
.logo-circle { width: 32px; height: 32px; background-color: #1DB954; border-radius: 50%; box-shadow: 0 0 12px rgba(29, 185, 84, 0.4); }
.header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
.subtitle { font-size: 12px; color: #B3B3B3; }
.version-badge { background-color: #242424; color: #1DB954; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; border: 1px solid #333333; }
.settings-card { background-color: #181818; border: 1px solid #282828; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.section { display: flex; flex-direction: column; gap: 14px; border-bottom: 1px solid #242424; padding-bottom: 16px; }
.section:last-of-type { border-bottom: none; padding-bottom: 0; }
.section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px; color: #1DB954; font-weight: 700; }
.option-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.option-info { display: flex; flex-direction: column; gap: 3px; }
.option-title { font-size: 14px; font-weight: 600; color: #FFFFFF; cursor: pointer; }
.option-desc { font-size: 12px; color: #A0A0A0; }
.option-desc code { background-color: #222222; padding: 2px 4px; border-radius: 4px; color: #1DB954; font-family: monospace; }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333333; transition: 0.25s; border-radius: 24px; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.25s; border-radius: 50%; }
input:checked + .slider { background-color: #1DB954; }
input:checked + .slider:before { transform: translateX(20px); }
.actions-bar { display: flex; align-items: center; gap: 12px; padding-top: 4px; }
.btn-primary { background-color: #1DB954; color: #000000; border: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 20px; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
.btn-primary:hover { background-color: #1ED760; }
.btn-primary:active { transform: scale(0.98); }
.save-status { font-size: 12px; color: #1DB954; font-weight: 600; }
.diagnostic-box { background-color: #181818; border: 1px solid #282828; border-radius: 12px; padding: 16px; font-size: 12px; color: #B3B3B3; display: flex; flex-direction: column; gap: 10px; }
.diagnostic-box h3 { font-size: 13px; color: #FFFFFF; font-weight: 600; }
.diagnostic-box ol { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.diagnostic-box code { color: #1DB954; background-color: #222222; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
.btn-secondary { align-self: flex-start; background-color: #282828; border: 1px solid #3E3E3E; color: #FFFFFF; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: background-color 0.15s; }
.btn-secondary:hover { background-color: #333333; }
.diag-output { background-color: #0F0F0F; border: 1px solid #282828; border-radius: 6px; padding: 10px; color: #1DB954; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
.hidden { display: none !important; }`
  },
  {
    path: 'options/options.js',
    filename: 'options.js',
    category: 'options',
    description: 'Options page controller: saves and restores preferences via browser.storage.local',
    content: `/**
 * Spotify Web Controls - Options Page Logic
 */

(function () {
  'use strict';

  const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

  const optExtensionEnabled = document.getElementById('opt-extension-enabled');
  const optNotification = document.getElementById('opt-notification');
  const optSeek = document.getElementById('opt-seek');
  const optDebug = document.getElementById('opt-debug');
  const btnSave = document.getElementById('btn-save');
  const saveStatus = document.getElementById('save-status');
  const btnRunLocalDiag = document.getElementById('btn-run-local-diag');
  const diagOutput = document.getElementById('diag-output');

  const DEFAULT_CONFIG = {
    extensionEnabled: true,
    debugEnabled: true,
    seekControlsEnabled: true,
    notificationIntegrationEnabled: true
  };

  function restoreOptions() {
    browserAPI.storage.local.get(DEFAULT_CONFIG, (items) => {
      optExtensionEnabled.checked = items.extensionEnabled !== false;
      optNotification.checked = items.notificationIntegrationEnabled !== false;
      optSeek.checked = items.seekControlsEnabled !== false;
      optDebug.checked = items.debugEnabled !== false;
    });
  }

  function saveOptions() {
    const config = {
      extensionEnabled: optExtensionEnabled.checked,
      notificationIntegrationEnabled: optNotification.checked,
      seekControlsEnabled: optSeek.checked,
      debugEnabled: optDebug.checked
    };

    browserAPI.storage.local.set(config, () => {
      browserAPI.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        config: config
      }, () => {
        saveStatus.textContent = 'Settings saved successfully!';
        setTimeout(() => {
          saveStatus.textContent = '';
        }, 2500);
      });
    });
  }

  btnRunLocalDiag.addEventListener('click', () => {
    diagOutput.textContent = 'Querying background & active Spotify tabs...';
    diagOutput.classList.remove('hidden');

    browserAPI.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (browserAPI.runtime.lastError) {
        diagOutput.textContent = \`Error: \${browserAPI.runtime.lastError.message}\`;
      } else {
        diagOutput.textContent = JSON.stringify(response, null, 2);
      }
    });
  });

  btnSave.addEventListener('click', saveOptions);
  document.addEventListener('DOMContentLoaded', restoreOptions);
})();`
  }
];
