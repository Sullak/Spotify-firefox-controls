import React, { useState } from 'react';
import { EXTENSION_FILES, ExtensionFile } from '../extensionFiles';
import { FileCode, Copy, Check, Folder, Download, Eye } from 'lucide-react';
import { generateExtensionZip, downloadBlob } from '../utils/zipGenerator';

export const FileViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ExtensionFile>(EXTENSION_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const blob = await generateExtensionZip();
      downloadBlob(blob, 'spotify-web-controls-firefox-android.zip');
    } catch (err) {
      console.error('Failed to create zip', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Download Button - Geometric Balance */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-[#181818] border border-white/10 shadow-2xl">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#1DB954] block mb-1">
            Production Package
          </span>
          <h2 className="text-xl font-black tracking-tight text-white">Extension File Tree & Source Code</h2>
          <p className="text-xs text-white/50 mt-1">
            Complete, uncompressed production files ready for Firefox Android developer loading.
          </p>
        </div>
        <button
          onClick={handleDownloadZip}
          disabled={isZipping}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1DB954] hover:bg-[#1ED760] text-black font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-[#1DB954]/20 active:scale-95 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isZipping ? 'Packaging ZIP...' : 'Download ZIP Archive'}
        </button>
      </div>

      {/* Main Grid: Sidebar File Explorer + Code Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 rounded-2xl border border-white/10 bg-[#181818] overflow-hidden shadow-2xl">
        
        {/* Left Column: File Explorer */}
        <div className="md:col-span-4 border-r border-white/5 p-4 bg-black/20 space-y-3">
          <div className="px-2 py-1 text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-[#1DB954]" />
            <span>spotify-controls/</span>
          </div>

          <div className="space-y-1.5">
            {EXTENSION_FILES.map((file) => {
              const isActive = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between transition ${
                    isActive
                      ? 'bg-[#1DB954]/10 text-[#1DB954] font-bold border border-[#1DB954]/30'
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase bg-white/5 text-white/40 border border-white/5">
                    {file.category}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-white/50 space-y-1">
            <div className="font-bold text-white/70 uppercase tracking-wider text-[10px]">Module Description:</div>
            <div>{selectedFile.description}</div>
          </div>
        </div>

        {/* Right Column: Code Viewer with Copy Button */}
        <div className="md:col-span-8 flex flex-col bg-black/40">
          <div className="flex items-center justify-between px-5 py-3 bg-[#181818] border-b border-white/5">
            <div className="flex items-center gap-2 font-mono text-xs text-white/70">
              <span className="text-[#1DB954]">●</span>
              <span>spotify-controls/{selectedFile.path}</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <div className="p-5 flex-1 overflow-x-auto max-h-[620px] font-mono text-[11px] leading-relaxed text-green-400/90 bg-[#0C0C0C]">
            <pre className="whitespace-pre">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
};
