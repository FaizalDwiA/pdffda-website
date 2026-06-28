import React from 'react';

export default function LoaderOverlay({ show, title, message, progress }) {
  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-200"
      id="loader-overlay"
    >
      <div className="bg-slate-950/60 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/10 max-w-sm w-full mx-4 flex flex-col items-center space-y-4">
        {/* Spinner animation */}
        <div className="h-10 w-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin"></div>
        
        <div className="text-center space-y-1">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            {title || 'Sedang Memproses...'}
          </h4>
          <p className="text-[11px] text-white/60 max-w-[240px]">
            {message || 'Menyusun berkas PDF lokal Anda.'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
          <div 
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-150" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="text-[10px] font-mono text-white/50 font-bold uppercase">
          {Math.round(progress)}% Selesai
        </div>
      </div>
    </div>
  );
}
