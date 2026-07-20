import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { rotatePdf, getPdfThumbnails } from '../js/pdfEngine.js';

const PDFJS_VERSION = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export default function RotatePdfPanel({ notify, setLoader, downloadBlob, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [rotations, setRotations] = useState([]); // Array of degrees per page: [0, 90, 180, 270...]
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const loadPdfFile = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Harap masukkan berkas PDF.');
      return;
    }

    setLoader({ show: true, title: 'Membaca PDF', message: 'Membuat pratinjau halaman...', progress: 15 });
    try {
      const result = await getPdfThumbnails(file, (curr, total) => {
        const percent = Math.round(15 + (curr / total) * 75);
        setLoader({
          show: true,
          title: 'Memuat Halaman',
          message: `Pratinjau halaman ${curr} dari ${total}...`,
          progress: percent,
        });
      });

      setPdfFile(file);
      setThumbnails(result.thumbnails);
      setRotations(new Array(result.numPages).fill(0));
      notify('success', 'PDF Dimuat', `${result.numPages} halaman siap diputar.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Memuat', 'Berkas PDF tidak dapat dibaca.');
      resetAll();
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await loadPdfFile(e.target.files[0]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await loadPdfFile(e.dataTransfer.files[0]);
    }
  };

  const resetAll = () => {
    setPdfFile(null);
    setThumbnails([]);
    setRotations([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const rotatePage = (index, delta) => {
    setRotations((prev) => {
      const next = [...prev];
      const current = next[index] || 0;
      next[index] = (current + delta + 360) % 360;
      return next;
    });
  };

  const rotateAllPages = (delta) => {
    setRotations((prev) => prev.map((angle) => (angle + delta + 360) % 360));
  };

  const resetAllRotations = () => {
    setRotations(new Array(thumbnails.length).fill(0));
  };

  const handleRunRotate = async () => {
    if (!pdfFile) return;

    const hasAnyRotation = rotations.some((angle) => angle !== 0);
    if (!hasAnyRotation) {
      notify('info', 'Rotasi 0°', 'Tidak ada halaman yang diubah posisinya.');
    }

    setLoader({ show: true, title: 'Memutar PDF', message: 'Menerapkan rotasi halaman...', progress: 40 });
    try {
      const rotatedBytes = await rotatePdf(pdfFile, rotations, (curr, total) => {
        const percent = Math.round(40 + (curr / total) * 50);
        setLoader({
          show: true,
          title: 'Memproses PDF',
          message: `Memutar halaman ${curr} dari ${total}...`,
          progress: percent,
        });
      });

      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const outName = `${baseName}_rotated.pdf`;

      downloadBlob(rotatedBytes, outName);
      notify('success', 'Rotasi Selesai', `Berkas PDF berhasil diputar dan diunduh.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Rotasi', err.message || 'Terjadi kesalahan saat memutar PDF.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  return (
    <section id="panel-rotate-pdf" className="tab-panel space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-white/80 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-98"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali ke Menu
          </button>
          <span className="text-white/40 text-xs font-semibold">/</span>
          <span className="text-indigo-400 text-xs font-bold font-mono uppercase tracking-wider">Putar PDF</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload Dropzone */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-indigo-400 tracking-widest uppercase">Putar Orientasi PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Putar halaman PDF searah atau berlawanan jarum jam per halaman maupun secara massal 100% offline.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive ? 'border-indigo-500 bg-indigo-600/10' : 'border-white/10 bg-black/20 hover:border-indigo-500 hover:bg-indigo-600/10'
              }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-indigo-400">Klik untuk memilih berkas PDF</div>
                <div className="text-[10px] text-white/40">Mendukung semua berkas PDF</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Interactive Page Rotation Grid */
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="space-y-0.5 truncate">
                <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>
                  {pdfFile.name}
                </h4>
                <div className="text-xs text-white/50 font-mono">
                  {formatBytes(pdfFile.size)} &bull; {thumbnails.length} Halaman
                </div>
              </div>
            </div>

            {/* Rotation Control Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => rotateAllPages(-90)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                title="Putar Semua Kiri 90°"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Putar Semua Kiri (-90°)</span>
              </button>

              <button
                onClick={() => rotateAllPages(90)}
                className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                title="Putar Semua Kanan 90°"
              >
                <span>Putar Semua Kanan (+90°)</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <button
                onClick={resetAllRotations}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Reset
              </button>

              <button
                onClick={resetAll}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Ganti File
              </button>
            </div>
          </div>

          {/* Page Preview Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {thumbnails.map((item, idx) => {
              const currentAngle = rotations[idx] || 0;
              return (
                <div
                  key={idx}
                  className="bg-black/30 border border-white/10 hover:border-indigo-500/40 rounded-xl p-3 flex flex-col justify-between space-y-3 transition-all duration-300 group relative"
                >
                  {/* Angle Badge */}
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                    <span className="text-white/60">Hal {item.page}</span>
                    <span className={`px-2 py-0.5 rounded-full ${currentAngle !== 0 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-white/40'}`}>
                      {currentAngle}°
                    </span>
                  </div>

                  {/* Thumbnail Image Container with CSS Rotation */}
                  <div className="h-48 w-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden p-2">
                    <img
                      src={item.src}
                      alt={`Halaman ${item.page}`}
                      style={{ transform: `rotate(${currentAngle}deg)` }}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 shadow-md"
                    />
                  </div>

                  {/* Page Individual Rotate Buttons */}
                  <div className="flex items-center justify-center gap-2 pt-1 border-t border-white/5">
                    <button
                      onClick={() => rotatePage(idx, -90)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Putar Kiri 90°"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => rotatePage(idx, 90)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Putar Kanan 90°"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          <div className="max-w-md mx-auto pt-4">
            <button
              onClick={handleRunRotate}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3.5 rounded-xl inline-flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-indigo-900/40 active:scale-98"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Simpan &amp; Unduh PDF Putar</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
