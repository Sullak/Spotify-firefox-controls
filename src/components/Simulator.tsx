import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Smartphone, Monitor, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';

interface SimulatedTrack {
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  art: string;
}

const PLAYLIST: SimulatedTrack[] = [
  {
    title: 'Starboy',
    artist: 'The Weeknd, Daft Punk',
    album: 'Starboy',
    duration: 230,
    art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80'
  },
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    art: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80'
  },
  {
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    duration: 243,
    art: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&q=80'
  }
];

interface LogEntry {
  id: string;
  time: string;
  type: 'bridge' | 'dom' | 'media-session' | 'android';
  message: string;
}

export const Simulator: React.FC = () => {
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(42);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debugEnabled, setDebugEnabled] = useState(true);
  const [seekEnabled, setSeekEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [mediaSessionActive, setMediaSessionActive] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const currentTrack = PLAYLIST[trackIndex];

  const addLog = (type: LogEntry['type'], message: string) => {
    if (!debugEnabled && type !== 'android') return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs((prev) => [...prev.slice(-40), { id: Math.random().toString(), time: timeStr, type, message }]);
  };

  useEffect(() => {
    addLog('bridge', 'Media Session interception and persistent handlers initialized.');
    addLog('bridge', 'Registered persistent handlers for: play, pause, previoustrack, nexttrack, seekbackward, seekforward, seekto, stop');
    addLog('dom', 'Spotify detected: Initializing DOM Scanner & MutationObserver');
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Playback timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setPosition((p) => {
          if (p >= currentTrack.duration) {
            handleNext('Auto');
            return 0;
          }
          return p + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentTrack.duration]);

  const handlePlayPause = (source: 'Android Notification' | 'Spotify UI' | 'Extension Popup') => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    addLog('dom', `Action: ${nextState ? 'play' : 'pause'} initiated by [${source}]`);
    addLog('bridge', `Action received from Android/Firefox MediaSession: ${nextState ? 'play' : 'pause'}`);
    addLog('bridge', `Updated mediaSession.playbackState to: ${nextState ? 'playing' : 'paused'}`);
  };

  const handleNext = (source: string) => {
    addLog('bridge', `Action received from Android/Firefox MediaSession: nexttrack (source: ${source})`);
    addLog('dom', 'Executing Spotify Next: clicking [data-testid="control-button-skip-forward"]');
    const nextIdx = (trackIndex + 1) % PLAYLIST.length;
    setTrackIndex(nextIdx);
    setPosition(0);
    addLog('dom', `Track changed: ${PLAYLIST[nextIdx].title} - ${PLAYLIST[nextIdx].artist}`);
    addLog('bridge', `Updated mediaSession.metadata: title="${PLAYLIST[nextIdx].title}", artist="${PLAYLIST[nextIdx].artist}"`);
  };

  const handlePrev = (source: string) => {
    addLog('bridge', `Action received from Android/Firefox MediaSession: previoustrack (source: ${source})`);
    addLog('dom', 'Executing Spotify Previous: clicking [data-testid="control-button-skip-back"]');
    const prevIdx = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    setTrackIndex(prevIdx);
    setPosition(0);
    addLog('dom', `Track changed: ${PLAYLIST[prevIdx].title} - ${PLAYLIST[prevIdx].artist}`);
    addLog('bridge', `Updated mediaSession.metadata: title="${PLAYLIST[prevIdx].title}", artist="${PLAYLIST[prevIdx].artist}"`);
  };

  const handleSeek = (offsetSeconds: number) => {
    if (!seekEnabled) {
      addLog('dom', '[Spotify Controls] Action not supported: Seek controls disabled in settings');
      return;
    }
    const newPos = Math.max(0, Math.min(currentTrack.duration, position + offsetSeconds));
    setPosition(newPos);
    addLog('bridge', `Action received from Android/Firefox MediaSession: ${offsetSeconds > 0 ? 'seekforward' : 'seekbackward'} (${Math.abs(offsetSeconds)}s)`);
    addLog('dom', `Seek applied: ${newPos}s (${Math.round((newPos / currentTrack.duration) * 100)}%) via pointerdown on slider`);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header - Geometric Balance Style */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#181818] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1DB954] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">Extension Bridge: Active</span>
          <span className="px-2.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/10 text-[10px] font-mono">
            MAIN_WORLD_INJECTED
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white transition">
            <input
              type="checkbox"
              checked={debugEnabled}
              onChange={(e) => setDebugEnabled(e.target.checked)}
              className="accent-[#1DB954] rounded"
            />
            <span className="font-medium">Debug Logs</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white transition">
            <input
              type="checkbox"
              checked={seekEnabled}
              onChange={(e) => setSeekEnabled(e.target.checked)}
              className="accent-[#1DB954] rounded"
            />
            <span className="font-medium">Seek (±15s)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white transition">
            <input
              type="checkbox"
              checked={notificationEnabled}
              onChange={(e) => setNotificationEnabled(e.target.checked)}
              className="accent-[#1DB954] rounded"
            />
            <span className="font-medium">Android Sync</span>
          </label>
        </div>
      </div>

      {/* Side-by-Side Playground: Spotify Web Player vs. Android Notification Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Spotify Web Player Interface */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-[#181818] rounded-2xl p-6 sm:p-8 border border-white/5 shadow-2xl space-y-8">
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start sm:items-end">
            {/* Geometric Album Art Container */}
            <div className="w-44 h-44 sm:w-52 sm:h-52 bg-neutral-800 rounded-xl shadow-2xl overflow-hidden relative group border border-white/10 shrink-0">
              <img
                src={currentTrack.art}
                alt="Artwork"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none"></div>
              <div className="absolute bottom-3 left-3 right-3">
                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1DB954] transition-all duration-300"
                    style={{ width: `${(position / currentTrack.duration) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Track Info & Status Chips */}
            <div className="flex-1 overflow-hidden min-w-0">
              <span className="text-xs font-bold uppercase tracking-widest text-[#1DB954] block mb-1">
                Now Playing
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mb-1.5 tracking-tight leading-none text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-lg sm:text-xl text-white/60 mb-4 truncate font-medium">
                {currentTrack.artist} • {currentTrack.album}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="px-3 py-1 bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/30 rounded text-xs font-bold">
                  ACTIVE SESSION
                </div>
                <div className="px-3 py-1 bg-white/5 text-white/40 border border-white/10 rounded text-xs font-bold uppercase tracking-tight italic">
                  Premium (Web Player)
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar with timestamp indicators */}
          <div className="space-y-2">
            <div
              className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const newPos = Math.round(ratio * currentTrack.duration);
                setPosition(newPos);
                addLog('dom', `Progress clicked: seek to ${newPos}s (${Math.round(ratio * 100)}%)`);
              }}
            >
              <div
                className="h-full bg-[#1DB954] rounded-full transition-all duration-200"
                style={{ width: `${(position / currentTrack.duration) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40 font-mono">
              <span>{formatTime(position)}</span>
              <span>{formatTime(currentTrack.duration)}</span>
            </div>
          </div>

          {/* Player Controls & Seek Pills */}
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex gap-6 sm:gap-8 items-center">
                <button
                  onClick={() => handlePrev('Spotify UI')}
                  title="Previous Track"
                  className="opacity-60 hover:opacity-100 text-white transition-opacity active:scale-90"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={() => handlePlayPause('Spotify UI')}
                  title={isPlaying ? 'Pause' : 'Play'}
                  className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center transform active:scale-95 transition-transform hover:scale-105 shadow-xl text-black"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 fill-black" />
                  ) : (
                    <Play className="w-8 h-8 fill-black translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleNext('Spotify UI')}
                  title="Next Track"
                  className="opacity-60 hover:opacity-100 text-white transition-opacity active:scale-90"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSeek(-15)}
                  className="px-4 py-2 bg-white/5 rounded-full text-xs font-bold border border-white/10 hover:bg-white/10 text-white transition active:scale-95"
                >
                  - 15s
                </button>
                <button
                  onClick={() => handleSeek(15)}
                  className="px-4 py-2 bg-white/5 rounded-full text-xs font-bold border border-white/10 hover:bg-white/10 text-white transition active:scale-95"
                >
                  + 15s
                </button>
              </div>
            </div>

            <div className="h-[1px] w-full bg-white/5"></div>

            <div className="flex flex-wrap justify-between gap-2 text-xs font-mono text-white/40">
              <span>CONTENT_SCRIPT: LOADED</span>
              <span>BRIDGE_CONTEXT: MAIN_WORLD</span>
              <span>PLATFORM: FIREFOX_ANDROID_120</span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Android Media Notification Shade Simulation */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#181818] rounded-2xl p-6 border border-white/5 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#1DB954]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">
                Android Notification Shade
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#1DB954]/10 text-[#1DB954] font-mono font-bold border border-[#1DB954]/20">
              MediaStyle
            </span>
          </div>

          {/* Android Notification Card */}
          <div className="p-5 rounded-2xl bg-[#121212] border border-white/10 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between text-xs text-white/40">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-600 flex items-center justify-center text-[10px] font-bold text-white">
                  F
                </div>
                <span className="font-semibold text-white/80">Firefox • Spotify</span>
              </div>
              <span className="text-[10px] font-mono text-white/40">GeckoView MediaSession</span>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={currentTrack.art}
                alt="Notification Artwork"
                className="w-16 h-16 rounded-xl object-cover shadow-md border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
                <p className="text-xs text-white/60 truncate">{currentTrack.artist}</p>
                <p className="text-[11px] text-white/40 truncate">{currentTrack.album}</p>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-1">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/80 rounded-full"
                  style={{ width: `${(position / currentTrack.duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/40 font-mono">
                <span>{formatTime(position)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
            </div>

            {/* Android Notification Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => handleSeek(-15)}
                title="Rewind 15s"
                className="p-2 text-white/50 hover:text-white transition active:scale-90"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePrev('Android Notification')}
                title="Previous Track"
                className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition active:scale-90"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => handlePlayPause('Android Notification')}
                title="Play / Pause"
                className="p-3 rounded-full bg-white text-black hover:bg-white/90 transition active:scale-90"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => handleNext('Android Notification')}
                title="Next Track"
                className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition active:scale-90"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => handleSeek(15)}
                title="Fast Forward 15s"
                className="p-2 text-white/50 hover:text-white transition active:scale-90"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-white/40 pt-1">
            <span>Actions: [prev, play, pause, next, seek]</span>
            <span className="text-[#1DB954] font-semibold">Exposed to OS</span>
          </div>
        </div>

      </div>

      {/* Geometric Balance Diagnostic Console Card */}
      <div className="bg-[#181818] rounded-2xl p-6 border border-white/5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#1DB954]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
              Diagnostic Console
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-[#1DB954] rounded border border-green-500/20 uppercase font-bold">
              Debug Active
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-white/40 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Terminal Log Container */}
        <div className="bg-black/40 rounded-lg p-4 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-56 text-green-400/90 border border-white/5 space-y-1">
          {logs.length === 0 ? (
            <div className="text-white/30 italic">No logs recorded yet. Interact with the controls above.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-white/30 shrink-0">{log.time}</span>
                <span
                  className={`font-semibold shrink-0 ${
                    log.type === 'bridge'
                      ? 'text-purple-400'
                      : log.type === 'dom'
                      ? 'text-[#1DB954]'
                      : 'text-amber-400'
                  }`}
                >
                  [{log.type.toUpperCase()}]
                </span>
                <span className="text-white/80 break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Metric / Status key-value rows */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
            <span className="text-white/60">Media Session Status</span>
            <span className="font-bold text-[#1DB954]">ACTIVE</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
            <span className="text-white/60">Notification Bridge</span>
            <span className="font-bold text-[#1DB954]">ENABLED</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-white/60">User Profile Sync</span>
            <span className="font-bold text-white/40 italic uppercase text-[10px]">
              Win10/Chrome152 Mask
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
