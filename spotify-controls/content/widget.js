/**
 * Spotify Web Controls - Floating Controller Widget
 *
 * Touch-friendly in-page controls for Spotify Web Player.
 * Uses the existing isolated-world player controller directly; it does not
 * alter Media Session behavior or the diagnostic bridge.
 */

(function () {
  'use strict';

  if (window.__SPOTIFY_CONTROLS_WIDGET_LOADED__) return;
  window.__SPOTIFY_CONTROLS_WIDGET_LOADED__ = true;

  const WIDGET_ID = 'spotify-web-controls-widget';
  const PANEL_ID = `${WIDGET_ID}-panel`;
  const POLL_MS = 500;
  const SEEK_SECONDS = 10;

  let root = null;
  let panel = null;
  let expanded = false;
  let lastStateKey = '';

  function controllerReady() {
    return window.__spotifyPlayerController &&
      typeof window.__spotifyPlayerController.executeAction === 'function';
  }

  function execute(action, details = {}) {
    if (!controllerReady()) return false;
    try {
      return window.__spotifyPlayerController.executeAction(action, details) === true;
    } catch (error) {
      console.error('[Spotify Controls:Widget] Action failed:', action, error);
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById(`${WIDGET_ID}-styles`)) return;

    const style = document.createElement('style');
    style.id = `${WIDGET_ID}-styles`;
    style.textContent = `
      #${WIDGET_ID} {
        position: fixed;
        z-index: 2147483647;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #fff;
        user-select: none;
      }
      #${WIDGET_ID} * { box-sizing: border-box; }
      #${WIDGET_ID} button {
        appearance: none;
        border: 0;
        color: #fff;
        background: rgba(25, 25, 25, .94);
        font: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      #${WIDGET_ID} button:active { transform: scale(.94); }
      #${WIDGET_ID} button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      #${WIDGET_ID}-toggle {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 25px;
        box-shadow: 0 3px 16px rgba(0,0,0,.45);
      }
      #${PANEL_ID} {
        width: min(340px, calc(100vw - 24px));
        margin-bottom: 9px;
        padding: 12px;
        border-radius: 16px;
        background: rgba(20, 20, 20, .97);
        box-shadow: 0 8px 28px rgba(0,0,0,.5);
        backdrop-filter: blur(10px);
      }
      #${WIDGET_ID}-info {
        display: flex;
        align-items: center;
        min-width: 0;
        margin-bottom: 10px;
      }
      #${WIDGET_ID}-art {
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        border-radius: 7px;
        object-fit: cover;
        background: #333;
      }
      #${WIDGET_ID}-text { min-width: 0; margin-left: 10px; }
      #${WIDGET_ID}-title,
      #${WIDGET_ID}-artist {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${WIDGET_ID}-title { font-size: 14px; font-weight: 700; }
      #${WIDGET_ID}-artist { margin-top: 2px; font-size: 12px; opacity: .7; }
      #${WIDGET_ID}-progress {
        width: 100%;
        height: 5px;
        margin: 4px 0 10px;
        border-radius: 5px;
        background: rgba(255,255,255,.2);
        overflow: hidden;
      }
      #${WIDGET_ID}-progress-fill {
        width: 0%;
        height: 100%;
        background: #fff;
        transition: width .2s linear;
      }
      #${WIDGET_ID}-time {
        display: flex;
        justify-content: space-between;
        margin-bottom: 9px;
        font-size: 10px;
        opacity: .6;
      }
      #${WIDGET_ID}-controls {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 7px;
      }
      #${WIDGET_ID}-controls button {
        min-height: 48px;
        border-radius: 11px;
        font-size: 20px;
      }
      #${WIDGET_ID}-controls .primary {
        font-size: 24px;
        background: rgba(255,255,255,.16);
      }
      @media (max-width: 380px) {
        #${PANEL_ID} { width: calc(100vw - 24px); }
        #${WIDGET_ID}-controls { gap: 5px; }
        #${WIDGET_ID}-controls button { min-height: 44px; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return `${minutes}:${secs}`;
  }

  function button(label, text, action, details = {}, className = '') {
    const el = document.createElement('button');
    el.type = 'button';
    el.setAttribute('aria-label', label);
    el.title = label;
    el.textContent = text;
    if (className) el.className = className;
    if (className !== 'primary') {
      el.addEventListener('click', () => {
        execute(action, details);
        setTimeout(update, 80);
      });
    }
    return el;
  }

  function buildWidget() {
    if (root || !document.body) return;
    injectStyles();

    root = document.createElement('aside');
    root.id = WIDGET_ID;
    root.setAttribute('aria-label', 'Spotify Web Controller');

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.hidden = true;

    const info = document.createElement('div');
    info.id = `${WIDGET_ID}-info`;

    const art = document.createElement('img');
    art.id = `${WIDGET_ID}-art`;
    art.alt = '';

    const text = document.createElement('div');
    text.id = `${WIDGET_ID}-text`;

    const title = document.createElement('div');
    title.id = `${WIDGET_ID}-title`;
    title.textContent = 'Spotify';

    const artist = document.createElement('div');
    artist.id = `${WIDGET_ID}-artist`;
    artist.textContent = 'Player';

    text.append(title, artist);
    info.append(art, text);

    const progress = document.createElement('div');
    progress.id = `${WIDGET_ID}-progress`;
    const fill = document.createElement('div');
    fill.id = `${WIDGET_ID}-progress-fill`;
    progress.appendChild(fill);

    const time = document.createElement('div');
    time.id = `${WIDGET_ID}-time`;
    const current = document.createElement('span');
    const duration = document.createElement('span');
    current.textContent = '0:00';
    duration.textContent = '0:00';
    time.append(current, duration);

    const controls = document.createElement('div');
    controls.id = `${WIDGET_ID}-controls`;
    controls.append(
      button('Retroceder 10 segundos', '↶', 'seekbackward', { seekOffset: SEEK_SECONDS }),
      button('Anterior', '⏮', 'previoustrack'),
      button('Reproducir / Pausar', '▶', 'play', {}, 'primary'),
      button('Siguiente', '⏭', 'nexttrack'),
      button('Avanzar 10 segundos', '↷', 'seekforward', { seekOffset: SEEK_SECONDS })
    );

    panel.append(info, progress, time, controls);

    const toggle = document.createElement('button');
    toggle.id = `${WIDGET_ID}-toggle`;
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Abrir controles de Spotify');
    toggle.title = 'Controles de Spotify';
    toggle.textContent = '♫';
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      panel.hidden = !expanded;
      toggle.setAttribute('aria-label', expanded ? 'Cerrar controles de Spotify' : 'Abrir controles de Spotify');
      toggle.textContent = expanded ? '×' : '♫';
      update();
    });

    root.append(panel, toggle);
    document.body.appendChild(root);
    update();
  }

  function update() {
    if (!root || !controllerReady()) return;

    let state;
    try {
      state = window.__spotifyPlayerController.getState();
    } catch (error) {
      return;
    }
    if (!state) return;

    const key = [state.title, state.artist, state.artwork, state.playbackState,
      Math.floor(state.position || 0), Math.floor(state.duration || 0)].join('|');
    if (key === lastStateKey && !expanded) return;
    lastStateKey = key;

    const title = root.querySelector(`#${WIDGET_ID}-title`);
    const artist = root.querySelector(`#${WIDGET_ID}-artist`);
    const art = root.querySelector(`#${WIDGET_ID}-art`);
    const fill = root.querySelector(`#${WIDGET_ID}-progress-fill`);
    const time = root.querySelector(`#${WIDGET_ID}-time`);
    const play = root.querySelector(`#${WIDGET_ID}-controls .primary`);

    title.textContent = state.title || 'Spotify';
    artist.textContent = state.artist || 'Spotify Web Player';

    if (state.artwork && art.src !== state.artwork) {
      art.src = state.artwork;
    } else if (!state.artwork) {
      art.removeAttribute('src');
    }

    const pos = Number(state.position) || 0;
    const dur = Number(state.duration) || 0;
    fill.style.width = `${dur > 0 ? Math.min(100, Math.max(0, (pos / dur) * 100)) : 0}%`;
    time.firstChild.textContent = formatTime(pos);
    time.lastChild.textContent = formatTime(dur);
    play.textContent = state.playbackState === 'playing' ? '❚❚' : '▶';

    const playAction = state.playbackState === 'playing' ? 'pause' : 'play';
    play.onclick = () => {
      execute(playAction);
      setTimeout(update, 80);
    };
  }

  function start() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    buildWidget();
    setInterval(update, POLL_MS);
  }

  start();
})();
