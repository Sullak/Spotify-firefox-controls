import React, { useState } from 'react';
import { Simulator } from './components/Simulator';
import { FileViewer } from './components/FileViewer';
import { DiagnosticView } from './components/DiagnosticView';
import { InstallGuide } from './components/InstallGuide';
import { Download, PlayCircle, Code2, Cpu, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { generateExtensionZip, downloadBlob } from './utils/zipGenerator';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'files' | 'diagnostics' | 'guide'>('simulator');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const blob = await generateExtensionZip();
      downloadBlob(blob, 'spotify-web-controls-firefox-android.zip');
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#E0E0E0] font-sans antialiased selection:bg-[#1DB954] selection:text-black flex flex-col">
      {/* Top Header - Geometric Balance Style */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0B0B0B]/90 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1DB954] rounded-lg flex items-center justify-center shadow-lg shadow-[#1DB954]/20 shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-black" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 17.3c-.2.3-.6.4-.9.2-2.3-1.4-5.2-1.7-8.6-.9-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 3.7-.8 7-.5 9.6 1.1.3.1.4.5.3.8zm1.5-3.3c-.3.4-.8.5-1.2.3-2.6-1.6-6.7-2.1-9.8-1.1-.5.2-1-.1-1.1-.6-.2-.5.1-1 .6-1.1 3.6-1.1 8.1-.6 11.2 1.3.4.2.5.7.3 1.2zm.1-3.4c-3.2-1.9-8.5-2.1-11.5-1.2-.5.1-1-.2-1.1-.7s.2-1 .7-1.1c3.5-1.1 9.4-.8 13.1 1.4.4.3.6.8.3 1.3-.2.4-.8.6-1.2.3z"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#1DB954]">Firefox Android Ext</span>
              <h1 className="text-xl font-black tracking-tight text-white">SPOTIFY WEB CONTROLS</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse"></div>
              <span className="text-xs font-medium text-[#E0E0E0]">Connected to open.spotify.com</span>
            </div>
            <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-mono text-white/70">
              v1.2.0-STABLE
            </div>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DB954] hover:bg-[#1ED760] text-black text-xs font-extrabold uppercase tracking-wider transition shadow-lg shadow-[#1DB954]/20 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Empaquetando...' : 'Descargar ZIP'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-white/5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-[#1DB954] text-[#1DB954]'
                : 'border-transparent text-white/40 hover:text-white/90 hover:border-white/20'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Simulador Interactivo</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
              activeTab === 'files'
                ? 'border-[#1DB954] text-[#1DB954]'
                : 'border-transparent text-white/40 hover:text-white/90 hover:border-white/20'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Explorador de Código</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
              activeTab === 'diagnostics'
                ? 'border-[#1DB954] text-[#1DB954]'
                : 'border-transparent text-white/40 hover:text-white/90 hover:border-white/20'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Diagnóstico Técnico</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-[#1DB954] text-[#1DB954]'
                : 'border-transparent text-white/40 hover:text-white/90 hover:border-white/20'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Guía de Instalación</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeTab === 'simulator' && <Simulator />}
        {activeTab === 'files' && <FileViewer />}
        {activeTab === 'diagnostics' && <DiagnosticView />}
        {activeTab === 'guide' && <InstallGuide />}
      </main>

      {/* Footer - Geometric Balance Style */}
      <footer className="border-t border-white/5 mt-12 py-6 bg-[#0B0B0B] text-[10px] text-white/30 uppercase tracking-widest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>Secure Bridge Connection • No Data Externalized</span>
          <span>© 2026 Spotify Controls Extension</span>
          <span>Firefox Mobile Optimized</span>
        </div>
      </footer>
    </div>
  );
}
