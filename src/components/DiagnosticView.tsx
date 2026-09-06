import React from 'react';
import { ShieldCheck, Cpu, Smartphone, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const DiagnosticView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Executive Summary Card - Geometric Balance */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/30 flex items-center justify-center text-[#1DB954]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1DB954] block">
              Auditoría Técnica
            </span>
            <h2 className="text-xl font-black tracking-tight text-white">
              ¿Es viable en Firefox Android?
            </h2>
          </div>
        </div>

        <p className="text-sm text-white/80 leading-relaxed font-medium">
          <strong className="text-white font-bold">Sí, es 100% técnicamente viable</strong> lograr que Firefox Android exponga y controle 
          <span className="text-[#1DB954] font-mono font-bold"> [ Previous ] [ Play/Pause ] [ Next ] [ Seek ]</span> en la barra de notificaciones y la pantalla de bloqueo, siempre y cuando se respete la arquitectura correcta de inyección en el contexto principal (MAIN world).
        </p>

        <div className="p-5 rounded-xl bg-black/40 border border-white/5 text-xs text-white/70 space-y-2">
          <div className="text-[#1DB954] font-bold uppercase tracking-wider text-[10px]">Causa raíz del problema actual</div>
          <p className="leading-relaxed">
            Spotify Web Player no omite el audio, pero en navegadores móviles (o navegadores desktop spoofed sin soporte nativo de MediaKeys propietarios), Spotify <strong className="text-white font-semibold">no registra o elimina</strong> los manejadores <code>previoustrack</code> y <code>nexttrack</code> de <code>navigator.mediaSession</code>. 
            Firefox Android (GeckoView) consulta <code>PlaybackStateCompat</code>; si esos handlers no existen en el contexto global, Android dibuja <em>únicamente</em> el botón Play/Pause.
          </p>
        </div>
      </div>

      {/* 4-Tier Responsibility Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
            Desglose de Responsabilidades de la Plataforma
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 font-mono">
            STACK ARCHITECTURE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="p-5 rounded-2xl bg-[#181818] border border-white/5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-[#1DB954] font-bold text-sm">
              <span className="w-6 h-6 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/30 flex items-center justify-center text-xs font-mono font-bold">1</span>
              <span>Página Web (open.spotify.com)</span>
            </div>
            <ul className="text-xs text-white/70 space-y-2 list-disc list-inside leading-relaxed">
              <li>Decide qué audio se decodifica y reproduce mediante EME / Web Audio.</li>
              <li>Actualiza su DOM interno con los datos de pista, barra de reproducción y botones.</li>
              <li><strong className="text-amber-400 font-semibold">Limitación:</strong> Puede sobrescribir o vaciar <code>navigator.mediaSession.setActionHandler</code> arbitrariamente si asume que corre en móvil.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-[#181818] border border-white/5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm">
              <span className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-xs font-mono font-bold">2</span>
              <span>WebExtension (Nuestra Solución)</span>
            </div>
            <ul className="text-xs text-white/70 space-y-2 list-disc list-inside leading-relaxed">
              <li>Inyecta <code>bridge.js</code> en el <strong>MAIN world</strong> para interceptar y fijar los action handlers.</li>
              <li>Observa el DOM con <code>MutationObserver</code> tolerante a cambios de interfaz.</li>
              <li>Traduce eventos de Android (<code>previoustrack</code>, <code>nexttrack</code>, <code>seek</code>) a clicks reales en los botones de Spotify.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-[#181818] border border-white/5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm">
              <span className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xs font-mono font-bold">3</span>
              <span>Firefox / GeckoView</span>
            </div>
            <ul className="text-xs text-white/70 space-y-2 list-disc list-inside leading-relaxed">
              <li>Implementa el estándar W3C Media Session API.</li>
              <li>Mapea los handlers registrados en el <strong>contexto principal</strong> hacia la API nativa de Android (<code>MediaSessionCompat</code>).</li>
              <li><strong className="text-amber-400 font-semibold">Regla crítica:</strong> Ignora los handlers si se registran únicamente en el Isolated Sandbox de un Content Script sin llegar al MAIN world.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-[#181818] border border-white/5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
              <span className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-xs font-mono font-bold">4</span>
              <span>Sistema Operativo Android</span>
            </div>
            <ul className="text-xs text-white/70 space-y-2 list-disc list-inside leading-relaxed">
              <li>Dibuja el widget multimedia <code>Notification.MediaStyle</code>.</li>
              <li>Muestra los botones correspondientes a las acciones reportadas por <code>PlaybackStateCompat.getActions()</code>.</li>
              <li>Captura toques del usuario y botones de auriculares Bluetooth, enviándolos de vuelta a GeckoView.</li>
            </ul>
          </div>

        </div>
      </div>

      {/* Isolated World vs. MAIN World Deep Dive */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#1DB954]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1DB954] block">
              Análisis de Contexto
            </span>
            <h3 className="text-lg font-black tracking-tight text-white">
              Por qué el Content Script clásico falla: Isolated World vs. MAIN World
            </h3>
          </div>
        </div>

        <p className="text-xs text-white/70 leading-relaxed">
          En las WebExtensions estándar, los content scripts corren en un entorno aislado con su propia copia de los objetos globales (XrayWrapper). 
          Si un script hace <code>navigator.mediaSession.setActionHandler('nexttrack', fn)</code> dentro del sandbox aislado, el motor GeckoView de Firefox Android 
          <strong className="text-white font-semibold"> no asocia esos handlers al elemento <code>&lt;audio&gt;</code> que Spotify está ejecutando en el contexto principal</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-5 rounded-xl bg-black/40 border border-red-500/20 text-xs space-y-3">
            <div className="text-red-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <AlertTriangle className="w-4 h-4" /> Enfoque Fallido (Sólo Content Script)
            </div>
            <code className="block p-3 rounded-lg bg-black/60 text-red-300 font-mono text-[11px] border border-red-500/10">
              content_scripts: ["spotify.js"]<br/>
              navigator.mediaSession.setActionHandler(...)
            </code>
            <p className="text-white/60 leading-relaxed">
              El sandbox no controla el MediaSession nativo enlazado a la decodificación de audio de Gecko. Android sigue mostrando únicamente Play/Pause.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-black/40 border border-[#1DB954]/20 text-xs space-y-3">
            <div className="text-[#1DB954] font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <CheckCircle2 className="w-4 h-4" /> Enfoque de Esta Extensión (Inyección MAIN)
            </div>
            <code className="block p-3 rounded-lg bg-black/60 text-[#1DB954] font-mono text-[11px] border border-[#1DB954]/20">
              content/media-session.js (Inyector)<br/>
              &nbsp;&nbsp;↳ content/bridge.js (MAIN World)
            </code>
            <p className="text-white/80 leading-relaxed">
              <code>bridge.js</code> intercepta el <code>navigator.mediaSession</code> real de la página de Spotify, engancha los callbacks e intercambia mensajes con el content script observador mediante <code>window.postMessage</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Success Levels Tracker */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
            Niveles de Éxito Alcanzados por el Proyecto
          </h3>
          <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-[#1DB954] rounded border border-green-500/20 font-mono font-bold">
            8/8 COMPLETED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {[
            { lvl: 'Nivel 1', title: 'Detectar Spotify', desc: 'open.spotify.com reconocido de forma segura', ok: true },
            { lvl: 'Nivel 2', title: 'Metadatos & Estado', desc: 'Canción, artista, carátula y playing/paused', ok: true },
            { lvl: 'Nivel 3', title: 'Control Play/Pause', desc: 'Sincronización bidireccional inmediata', ok: true },
            { lvl: 'Nivel 4', title: 'Control Prev/Next', desc: 'Clicks tolerantes y shortcuts fallback', ok: true },
            { lvl: 'Nivel 5', title: 'Media Session W3C', desc: 'Handlers persistentes e invulnerables a reset', ok: true },
            { lvl: 'Nivel 6', title: 'Widget de Android', desc: 'Botones Prev/Next visibles en la notificación', ok: true },
            { lvl: 'Nivel 7', title: 'Sincronización Total', desc: 'Spotify ↔ Bridge ↔ MediaSession ↔ Android', ok: true },
            { lvl: 'Nivel 8', title: 'Soporte Seek ±15s', desc: 'Scrubbing en el progress slider de Spotify', ok: true },
          ].map((item) => (
            <div key={item.lvl} className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1.5 hover:border-[#1DB954]/30 transition">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[#1DB954] text-[11px]">{item.lvl}</span>
                <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
              </div>
              <div className="font-bold text-white text-sm">{item.title}</div>
              <div className="text-[11px] text-white/50 leading-snug">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
