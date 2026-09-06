/**
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

// Initialize default settings on install or startup
browserAPI.runtime.onInstalled.addListener(() => {
  browserAPI.storage.local.get(null, (existing) => {
    const updated = { ...DEFAULT_CONFIG, ...existing };
    browserAPI.storage.local.set(updated, () => {
      log('Default configuration initialized:', updated);
    });
  });
});

/**
 * Finds the most relevant open Spotify Web tab.
 */
async function getSpotifyTab() {
  return new Promise((resolve) => {
    browserAPI.tabs.query({ url: '*://open.spotify.com/*' }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      // Prefer active or audible tab
      const activeOrAudible = tabs.find(t => t.active || t.audible);
      resolve(activeOrAudible || tabs[0]);
    });
  });
}

// Handle messages from Popup, Options, or Content scripts
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  log(`Message received: ${message.type}`, message);

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
    return true; // Keep message channel open for async response
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
            sendResponse({
              success: false,
              error: browserAPI.runtime.lastError.message
            });
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
      // Broadcast config change to all open Spotify tabs
      browserAPI.tabs.query({ url: '*://open.spotify.com/*' }, (tabs) => {
        if (tabs) {
          tabs.forEach(tab => {
            browserAPI.tabs.sendMessage(tab.id, {
              action: 'UPDATE_CONFIG',
              config: message.config
            }, () => {
              // Ignore errors if tab closed or reloaded
              if (browserAPI.runtime.lastError) {}
            });
          });
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }
});
