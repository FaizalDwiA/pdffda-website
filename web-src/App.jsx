import React, { useState } from 'react';
import MergePanel from './components/MergePanel';
import SplitPanel from './components/SplitPanel';
import ImageToPdfPanel from './components/ImageToPdfPanel';
import EditMetadataPanel from './components/EditMetadataPanel';
import PdfToWordPanel from './components/PdfToWordPanel';
import LoaderOverlay from './components/LoaderOverlay';
import ToastContainer from './components/ToastContainer';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
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
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center space-x-3 cursor-pointer select-none hover:opacity-90 active:scale-98 transition-all"
            title="Kembali ke Beranda"
          >
            <div className="flex items-center justify-center shrink-0">
              <img className="h-8 w-8 object-contain" src="./img/logo.webp" alt="Logo" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-widest leading-none uppercase">
                PDF<span className="text-blue-400">FDA</span>
              </h1>
              <p className="text-[9px] text-white/40 font-semibold uppercase mt-0.5">
                100% Client-Side &amp; Privacy-First
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-white/5 text-emerald-400 border border-emerald-500/20 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Offline / Aman
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="app-main" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-8 relative z-10">

        {activeTab === 'home' ? (
          <>
            {/* Hero Banner Section */}
            <div className="text-center max-w-3xl mx-auto space-y-4 pt-4 md:pt-10">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Setiap Alat PDF yang Anda Butuhkan dalam <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Satu Tempat</span>
              </h2>
              <p className="text-sm md:text-base text-white/60 leading-relaxed max-w-2xl mx-auto">
                Semua alat untuk memanipulasi dokumen PDF secara instan, gratis, dan 100% aman.
                File diproses secara lokal langsung di peramban Anda tanpa pernah diunggah ke server mana pun.
              </p>
            </div>

            {/* Premium Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto w-full pt-4">

              {/* Card 1: Merge PDF */}
              <div
                onClick={() => setActiveTab('panel-merge')}
                className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-orange-500/50 hover:bg-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-orange-950/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                <div className="space-y-4 relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-orange-400 transition-colors">Gabung PDF</h3>
                    <p className="text-white/60 text-xs mt-2 leading-relaxed">
                      Gabungkan beberapa file PDF menjadi satu dokumen beruntun sesuai urutan yang Anda tentukan secara instan.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-6 relative z-10">
                  <span className="text-orange-400 text-xs font-semibold inline-flex items-center gap-1 group-hover:underline">
                    Mulai Gabung
                    <svg className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Card 2: Split PDF */}
              <div
                onClick={() => setActiveTab('panel-split')}
                className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 hover:bg-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-blue-950/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                <div className="space-y-4 relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7h7m-7-3h7M5 19V5a2 2 0 012-2h4l2 2h4a2 2 0 012 2v2M5 19a2 2 0 002 2h10a2 2 0 002-2M5 19a2 2 0 01-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">Pisah &amp; Hapus Halaman</h3>
                    <p className="text-white/60 text-xs mt-2 leading-relaxed">
                      Ekstrak halaman tertentu atau hapus halaman terpilih dari berkas PDF Anda dengan pratinjau halaman visual.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-6 relative z-10">
                  <span className="text-blue-400 text-xs font-semibold inline-flex items-center gap-1 group-hover:underline">
                    Mulai Pisah
                    <svg className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Card 3: Image to PDF */}
              <div
                onClick={() => setActiveTab('panel-img')}
                className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-green-500/50 hover:bg-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-green-950/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                <div className="space-y-4 relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-green-400 transition-colors">Gambar ke PDF</h3>
                    <p className="text-white/60 text-xs mt-2 leading-relaxed">
                      Ubah gambar JPG, JPEG, atau PNG menjadi berkas PDF rapi dengan pengaturan layout, margin, dan orientasi.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-6 relative z-10">
                  <span className="text-green-400 text-xs font-semibold inline-flex items-center gap-1 group-hover:underline">
                    Mulai Konversi
                    <svg className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Card 4: Edit Metadata PDF */}
              <div
                onClick={() => setActiveTab('panel-metadata')}
                className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 hover:bg-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-purple-950/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                <div className="space-y-4 relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-purple-400 transition-colors">Edit Metadata</h3>
                    <p className="text-white/60 text-xs mt-2 leading-relaxed">
                      Ubah judul, penulis, subjek, kata kunci, pembuat, dan produser dokumen PDF secara offline.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-6 relative z-10">
                  <span className="text-purple-400 text-xs font-semibold inline-flex items-center gap-1 group-hover:underline">
                    Mulai Edit
                    <svg className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Card 5: PDF to Word */}
              <div
                onClick={() => setActiveTab('panel-word')}
                className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-cyan-950/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                <div className="space-y-4 relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-cyan-400 transition-colors">PDF ke Word (Gagal)</h3>
                    <p className="text-white/60 text-xs mt-2 leading-relaxed">
                      Ekstrak teks dari dokumen PDF Anda secara lokal dan konversikan ke file Word (.doc) yang dapat diedit.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-6 relative z-10">
                  <span className="text-cyan-400 text-xs font-semibold inline-flex items-center gap-1 group-hover:underline">
                    Mulai Konversi
                    <svg className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

            </div>
          </>
        ) : (
          /* PANELS WRAPPER */
          <div id="panels-container" className="relative z-10">
            {activeTab === 'panel-merge' && (
              <MergePanel
                notify={notify}
                setLoader={setLoader}
                downloadBlob={downloadBlob}
                formatBytes={formatBytes}
                generateId={generateId}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'panel-split' && (
              <SplitPanel
                notify={notify}
                setLoader={setLoader}
                downloadBlob={downloadBlob}
                formatBytes={formatBytes}
                generateId={generateId}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'panel-img' && (
              <ImageToPdfPanel
                notify={notify}
                setLoader={setLoader}
                downloadBlob={downloadBlob}
                formatBytes={formatBytes}
                generateId={generateId}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'panel-metadata' && (
              <EditMetadataPanel
                notify={notify}
                setLoader={setLoader}
                downloadBlob={downloadBlob}
                formatBytes={formatBytes}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'panel-word' && (
              <PdfToWordPanel
                notify={notify}
                setLoader={setLoader}
                formatBytes={formatBytes}
                onBack={() => setActiveTab('home')}
              />
            )}
          </div>
        )}

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
