import React, { useState } from 'react';
import MergePanel from './components/MergePanel';
import SplitPanel from './components/SplitPanel';
import ImageToPdfPanel from './components/ImageToPdfPanel';
import LoaderOverlay from './components/LoaderOverlay';
import ToastContainer from './components/ToastContainer';

export default function App() {
  const [activeTab, setActiveTab] = useState('panel-merge');
  const [toasts, setToasts] = useState([]);
  const [loader, setLoader] = useState({
    show: false,
    title: '',
    message: '',
    progress: 0,
  });

  // Unique ID generator for elements
  const generateId = () => {
    return Math.random().toString(36).substring(2, 9);
  };

  // Format raw bytes into human-readable indicators
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Custom Toast notification dispatch
  const notify = (type, title, message) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Trigger file download
  const downloadBlob = (uint8Array, defaultName) => {
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    
    const tempLink = document.createElement('a');
    tempLink.href = downloadUrl;
    tempLink.download = defaultName;
    document.body.appendChild(tempLink);
    
    tempLink.click();
    
    setTimeout(() => {
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#0c111d] text-white font-sans flex flex-col antialiased relative overflow-x-hidden">
      {/* Background Mesh Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-900/15 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/15 rounded-full blur-[100px]"></div>
      </div>

      {/* Header / Nav */}
      <header id="app-header" className="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-40 shadow-lg relative">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center shrink-0">
              <img className="h-8 w-8 object-contain" src="./img/logo.webp" alt="Logo" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-widest leading-none uppercase">
                PDF<span className="text-blue-400">FDA</span>
              </h1>
              <p className="text-[9px] text-white/40 font-semibold uppercase mt-0.5 animate-pulse">
                100% Client-Side &amp; Privacy-First
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-white/5 text-emerald-400 border border-emerald-500/20 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              <span className="hidden sm:inline">Mode: </span>Offline / Aman
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="app-main" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col space-y-4 sm:space-y-6 relative z-10">
        
        {/* Brief Description Header */}
        <div id="welcome-message" className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 backdrop-blur-xl border border-white/10 text-white rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/5 mix-blend-color-dodge pointer-events-none"></div>
          <div className="space-y-1 relative z-10">
            <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping shrink-0"></span>
              Kompilasi &amp; Modifikasi PDF Instan Tanpa Server
            </h2>
            <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
              Semua file diproses secara lokal langsung di peramban Anda. Dokumen rahasia Anda tidak akan pernah diunggah ke internet atau server mana pun demi privasi penuh.
            </p>
          </div>
          <div className="flex items-center space-x-2.5 self-start md:self-auto shrink-0 font-mono text-[10px] sm:text-xs text-white/80 relative z-10">
            <span className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">Zero Limit</span>
            <span className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">Data Aman</span>
          </div>
        </div>

        {/* Tab Navigation Switcher */}
        <nav id="tabs-navigation" className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1 overflow-x-auto w-full relative z-10" aria-label="Tabs">
          {/* Tab 1: Merge */}
          <button
            onClick={() => setActiveTab('panel-merge')}
            className={`flex-1 sm:flex-none shrink-0 min-w-max py-2.5 px-4 rounded-lg text-center font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer focus:outline-hidden ${
              activeTab === 'panel-merge'
                ? 'bg-blue-600 text-white shadow-lg font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="truncate">Gabung PDF</span>
          </button>

          {/* Tab 2: Split */}
          <button
            onClick={() => setActiveTab('panel-split')}
            className={`flex-1 sm:flex-none shrink-0 min-w-max py-2.5 px-4 rounded-lg text-center font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer focus:outline-hidden ${
              activeTab === 'panel-split'
                ? 'bg-blue-600 text-white shadow-lg font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7h7m-7-3h7M5 19V5a2 2 0 012-2h4l2 2h4a2 2 0 012 2v2M5 19a2 2 0 002 2h10a2 2 0 002-2M5 19a2 2 0 01-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2" />
            </svg>
            <span className="truncate">Pisah &amp; Hapus Halaman</span>
          </button>

          {/* Tab 3: Image to PDF */}
          <button
            onClick={() => setActiveTab('panel-img')}
            className={`flex-1 sm:flex-none shrink-0 min-w-max py-2.5 px-4 rounded-lg text-center font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer focus:outline-hidden ${
              activeTab === 'panel-img'
                ? 'bg-blue-600 text-white shadow-lg font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1" />
            </svg>
            <span className="truncate">Gambar ke PDF</span>
          </button>
        </nav>

        {/* PANELS WRAPPER */}
        <div id="panels-container" className="relative z-10">
          {activeTab === 'panel-merge' && (
            <MergePanel
              notify={notify}
              setLoader={setLoader}
              downloadBlob={downloadBlob}
              formatBytes={formatBytes}
              generateId={generateId}
            />
          )}

          {activeTab === 'panel-split' && (
            <SplitPanel
              notify={notify}
              setLoader={setLoader}
              downloadBlob={downloadBlob}
              formatBytes={formatBytes}
              generateId={generateId}
            />
          )}

          {activeTab === 'panel-img' && (
            <ImageToPdfPanel
              notify={notify}
              setLoader={setLoader}
              downloadBlob={downloadBlob}
              formatBytes={formatBytes}
              generateId={generateId}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer id="app-footer" className="bg-black/20 backdrop-blur-md border-t border-white/10 py-4 sm:py-5 mt-6 sm:mt-12 shrink-0 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:flex sm:justify-between sm:items-center space-y-2 sm:space-y-0 text-white/40">
          <p className="text-[11px] font-mono tracking-wide uppercase">&copy; 26-05-2026 PDFFDA. Semua Hak Dilindungi.</p>
          <p className="text-[10px] font-mono bg-white/5 text-white/50 px-3 py-1 rounded-lg border border-white/10 w-fit mx-auto sm:mx-0 shadow-inner">
            Lib: pdf-lib v1.17.1 &amp; pdfjs-dist v4.10.38
          </p>
        </div>
      </footer>

      {/* Progress Loader overlay */}
      <LoaderOverlay 
        show={loader.show} 
        title={loader.title} 
        message={loader.message} 
        progress={loader.progress} 
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
