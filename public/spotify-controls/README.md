# Spotify Web Controls — Extensión para Firefox Android

Extensión WebExtension local y modular diseñada específicamente para conectar el reproductor de **Spotify Web Player** (`https://open.spotify.com/`) con el sistema de control multimedia y las notificaciones de **Firefox Android** (GeckoView / Android MediaSession).

---

## 1. Qué hace la extensión

- **Inyección en MAIN World y MediaSession:** Inyecta un script puente en el contexto de ejecución principal de Spotify para interactuar directamente con `window.navigator.mediaSession` y evitar que Gecko descarte las acciones multimedia.
- **Exposición de Controles Multimedia:** Registra y mantiene activos los manejadores de acciones:
  - `previoustrack` (Pista anterior)
  - `nexttrack` (Pista siguiente)
  - `play` / `pause` (Reproducir / Pausar)
  - `seekbackward` / `seekforward` (-15s / +15s)
  - `seekto` (Scrubbing / salto de posición)
  - `stop` (Detener reproducción)
- **Extracción Resiliente de Metadatos:** Detecta título de la pista, artista, álbum, artwork (carátula en alta resolución) y duración mediante un motor tolerante a fallos con múltiples estrategias (data-testids, etiquetas ARIA multilingües y análisis estructural).
- **Sincronización Bidireccional:** Notifica a Android cuando el usuario cambia de canción en Spotify, y ejecuta los comandos de la notificación o botones físicos/auriculares Bluetooth en la interfaz de Spotify.
- **Popup y Panel de Opciones:** Proporciona un menú desplegable de control rápido y diagnóstico, y una página de opciones para habilitar/deshabilitar depuración, seek y notificaciones.
- **Completamente Local y Segura:** 0 llamadas a servidores externos, 0 telemetría, 0 APIs privadas con credenciales.

---

## 2. Qué problema intenta solucionar

En Firefox Android, al cargar Spotify Web (incluso aplicando perfiles spoofed como Windows 10 / Chrome):
1. El elemento `<audio>` reproduce la pista, pero Spotify Web **no registra o elimina** los manejadores `previoustrack` y `nexttrack` de la Media Session API en navegadores móviles o cuando detecta ciertas configuraciones.
2. Como resultado, el widget de la barra de notificaciones y la pantalla de bloqueo de Android únicamente muestra el botón **Play/Pause**, dejando ausentes los botones de pista siguiente y anterior.
3. Un content script tradicional corre en un *isolated world* (mundo aislado). En Firefox/GeckoView, registrar `navigator.mediaSession` en el sandbox aislado **no se vincula** a la sesión multimedia de audio nativa de la página principal.
4. **Solución:** Esta extensión inyecta un puente seguro en el `MAIN world`, engancha `navigator.mediaSession.setActionHandler`, registra los manejadores persistentes y los comunica con el observador DOM del reproductor.

---

## 3. Arquitectura técnica: Isolated World vs. MAIN World

```
┌─────────────────────────────────────────────────────────────┐
│                 PÁGINA (open.spotify.com)                   │
│                                                             │
│   [Spotify Web Player UI] ◄──────┐                          │
│          │ (Audio stream)        │ (Simulación de clicks)   │
│          ▼                       │                          │
│   [navigator.mediaSession]       │                          │
│          ▲                       │                          │
│          │ Intercepta & engancha │                          │
│   ┌──────┴───────────────────────┴──┐                       │
│   │    content/bridge.js (MAIN)     │                       │
│   └────────────────▲────────────────┘                       │
└────────────────────┼────────────────────────────────────────┘
                     │ window.postMessage (Canal seguro)
┌────────────────────┼────────────────────────────────────────┐
│                    ▼                                        │
│   ┌─────────────────────────────────┐                       │
│   │ content/media-session.js        │                       │
│   │ (Coordinador Isolated World)    │                       │
│   └────────────────┬────────────────┘                       │
│                    │                                        │
│                    ▼                                        │
│   ┌─────────────────────────────────┐                       │
│   │ content/spotify.js              │                       │
│   │ (Scanner DOM & Multi-strategy)  │                       │
│   └────────────────┬────────────────┘                       │
│                    │ browser.runtime.sendMessage            │
└────────────────────┼────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ background/background.js ◄───► popup / options              │
└─────────────────────────────────────────────────────────────┘
```

- **MAIN World (`content/bridge.js`):** Tiene acceso directo al objeto global `window.navigator.mediaSession` que GeckoView enlaza con Android.
- **Isolated World (`content/spotify.js` + `media-session.js`):** Gestiona el acceso al DOM, `MutationObserver` y las APIs de WebExtension (`storage`, `runtime`).
- **Background (`background/background.js`):** Mantiene la persistencia de configuración y retransmite eventos entre pestañas.

---

## 4. Instalación temporal en Firefox Android

Hay tres métodos según la variante de Firefox instalada:

### Método A: Firefox Nightly / Firefox Beta (Recomendado - Depuración USB / Wi-Fi)
1. En tu teléfono Android, abre **Firefox Nightly**.
2. Ve a **Ajustes** -> **Acerca de Firefox Nightly** y toca el logotipo de Firefox 5 veces seguidas para desbloquear el **Menú de Desarrollador**.
3. En Ajustes, entra en **Ajustes de desarrollador** y activa **Depuración USB** (o Wi-Fi).
4. Conecta el teléfono a tu ordenador con cable USB.
5. En Firefox de escritorio, abre:
   ```
   about:debugging#/setup
   ```
6. En la barra lateral izquierda, selecciona tu dispositivo Android y pulsa **Conectar**.
7. En la pestaña de tu dispositivo, busca la sección **Cargar complemento temporal...**.
8. Selecciona el archivo `manifest.json` dentro de la carpeta `spotify-controls/`.
9. ¡Listo! La extensión quedará instalada temporalmente en Firefox Android.

### Método B: Herramienta `web-ext` (Desarrollo directo desde terminal)
Si tienes Node.js en tu PC:
```bash
npx web-ext run --target=firefox-android --android-device=<ID_DISPOSITIVO> --source-dir=spotify-controls
```

### Método C: Firefox Developer Mode / Colección de complementos
Para instalaciones persistentes en Firefox Android, crea una colección en [addons.mozilla.org (AMO)](https://addons.mozilla.org/) y configura tu ID de usuario de AMO en los ajustes de Firefox Nightly.

---

## 5. Cómo activar el Modo Debug

1. Abre el menú de Firefox Android (los tres puntos verticales `⋮`).
2. Entra en **Complementos** (o Add-ons) -> **Spotify Web Controls**.
3. Toca **Opciones** (o Settings).
4. Activa el interruptor **Enable debug logging**.
5. Pulsa **Save Settings**.
6. Todos los eventos se registrarán en la consola con el prefijo:
   ```
   [Spotify Controls:Bridge]
   [Spotify Controls:DOM]
   ```

---

## 6. Cómo probar los controles

1. Abre `https://open.spotify.com/` en Firefox Android.
2. Inicia sesión y reproduce cualquier canción de una lista o álbum.
3. Baja la barra de notificaciones de Android.
4. Verifica que el widget multimedia muestre:
   - Nombre de la canción.
   - Artista.
   - Carátula del álbum.
   - Botón **Anterior (⏮)**.
   - Botón **Reproducir / Pausa (⏯)**.
   - Botón **Siguiente (⏭)**.
5. Toca **Siguiente**: Spotify cambiará de canción y la notificación actualizará el título.
6. Toca **Anterior**: Spotify volverá a la pista previa.

---

## 7. Cómo comprobar Media Session

Abre la consola de depuración remota de Firefox conectada a la pestaña de Spotify y escribe:
```javascript
window.__spotifyControlsDebug()
```
Devolverá un objeto con el estado actual:
```json
{
  "name": "Spotify Web Controls (Bridge Diagnostic)",
  "spotifyDetected": true,
  "mediaSessionAvailable": true,
  "playbackState": "playing",
  "activeHandlers": ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto", "stop"],
  "currentMetadata": {
    "title": "Song Name",
    "artist": "Artist Name",
    "album": "Album Name"
  }
}
```

---

## 8. Cómo interpretar los logs

En la consola de Firefox (vía `about:debugging`):
- `[Spotify Controls] Spotify detected`: La página `open.spotify.com` fue reconocida.
- `[Spotify Controls:Bridge] Registered persistent handler for: nexttrack`: El manejador nativo fue registrado en la sesión multimedia.
- `[Spotify Controls:Bridge] Action received from Android/Firefox MediaSession: nexttrack`: Android pulsó el botón "Next".
- `[Spotify Controls:DOM] Executing Spotify Next`: El content script localizó el botón de Spotify y simuló la pulsación.
- `[Spotify Controls:DOM] Track changed: Song Name - Artist`: MutationObserver detectó la nueva pista y actualizó MediaMetadata.
- `[Spotify Controls] Action not supported: ...`: Indica que un botón o selector no estuvo disponible temporalmente o la acción fue restringida.

---

## 9. Qué hacer si Spotify cambia sus selectores

La extensión utiliza un enfoque jerárquico en `content/spotify.js` (`SELECTOR_STRATEGIES`):
1. **Prioridad 1:** `data-testid` estándar (`control-button-skip-forward`, `control-button-play`, etc.).
2. **Prioridad 2:** Atributos `aria-label` multilingües (español, inglés y universal).
3. **Prioridad 3:** Contenedor de la barra de reproducción (`footer`, `now-playing-bar`) e iconos SVG.
4. **Prioridad 4:** Eventos de teclado sintéticos (`Space`, `MediaTrackNext`, `MediaTrackPrevious`).

Si Spotify modifica drásticamente su DOM:
1. Inspecciona el nuevo reproductor de Spotify en Firefox DevTools.
2. Identifica el nuevo atributo o clase del botón (ej. `[data-testid="nuevo-nombre"]`).
3. Añade el nuevo selector a la lista correspondiente en `content/spotify.js`.

---

## 10. Limitaciones conocidas de Firefox Android y Spotify

1. **Restricción de Audio en Segundo Plano de Android (Doze Mode):** Si el sistema operativo Android suspende el proceso de Firefox por ahorro de batería extremo, las notificaciones pueden pausarse. Se recomienda deshabilitar el "Ahorro de batería" para Firefox en los Ajustes del sistema.
2. **Cuentas Spotify Free (Límites de salto de canción):** Si la cuenta de Spotify ha agotado los skips disponibles en modo shuffle, Spotify deshabilita el botón de siguiente en la interfaz (`disabled`). La extensión respeta este estado y no fuerza acciones no permitidas por la cuenta.
3. **Manifest V3 en Firefox Android:** Firefox Android soporta MV3 con background scripts. Si utilizas una versión más antigua de Firefox (pre-109), puedes renombrar `manifest.v2.json` a `manifest.json`.
