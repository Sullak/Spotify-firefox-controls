/**
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

  // Restore options
  function restoreOptions() {
    browserAPI.storage.local.get(DEFAULT_CONFIG, (items) => {
      optExtensionEnabled.checked = items.extensionEnabled !== false;
      optNotification.checked = items.notificationIntegrationEnabled !== false;
      optSeek.checked = items.seekControlsEnabled !== false;
      optDebug.checked = items.debugEnabled !== false;
    });
  }

  // Save options
  function saveOptions() {
    const config = {
      extensionEnabled: optExtensionEnabled.checked,
      notificationIntegrationEnabled: optNotification.checked,
      seekControlsEnabled: optSeek.checked,
      debugEnabled: optDebug.checked
    };

    browserAPI.storage.local.set(config, () => {
      // Notify background script
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

  // Diagnostic runner
  btnRunLocalDiag.addEventListener('click', () => {
    diagOutput.textContent = 'Querying background & active Spotify tabs...';
    diagOutput.classList.remove('hidden');

    browserAPI.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (browserAPI.runtime.lastError) {
        diagOutput.textContent = `Error: ${browserAPI.runtime.lastError.message}`;
      } else {
        diagOutput.textContent = JSON.stringify(response, null, 2);
      }
    });
  });

  btnSave.addEventListener('click', saveOptions);
  document.addEventListener('DOMContentLoaded', restoreOptions);
})();
