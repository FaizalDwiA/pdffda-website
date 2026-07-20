import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { compressPdf } from '../js/pdfEngine.js';

const PDFJS_VERSION = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export default function CompressPdfPanel({ notify, setLoader, downloadBlob, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [compressLevel, setCompressLevel] = useState('recommended'); // 'extreme' | 'recommended' | 'less'
  const [isDragActive, setIsDragActive] = useState(false);
  const [resultData, setResultData] = useState(null); // { compressedBytes, origSize, newSize, savedPercent }
  const fileInputRef = useRef(null);

  const loadPdfFile = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Harap masukkan berkas PDF.');
      return;
    }

    setLoader({ show: true, title: 'Membaca PDF', message: 'Memuat halaman...', progress: 15 });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      setPdfFile(file);
      setNumPages(doc.numPages);
      setResultData(null);
      notify('success', 'PDF Dimuat', `${doc.numPages} halaman siap dikompresi.`);
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
    setNumPages(0);
    setResultData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRunCompress = async () => {
    if (!pdfFile) return;

    setLoader({ show: true, title: 'Mengompresi PDF', message: 'Memproses optimasi halaman...', progress: 10 });
    try {
      const compressedBytes = await compressPdf(pdfFile, { level: compressLevel }, (curr, total) => {
        const percent = Math.round((curr / total) * 90);
        setLoader({
          show: true,
          title: 'Mengompresi PDF',
          message: `Mengolah halaman ${curr} dari ${total}...`,
          progress: percent,
        });
      });

      const origSize = pdfFile.size;
      const newSize = compressedBytes.byteLength;
      const savedBytes = origSize - newSize;
      const savedPercent = Math.max(0, Math.round((savedBytes / origSize) * 100));

      const res = {
        compressedBytes,
        origSize,
        newSize,
        savedPercent,
      };

      setResultData(res);
      notify('success', 'Kompresi Selesai', `Ukuran berkas berhasil dikurangi sebesar ${savedPercent}%.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Mengompres', err.message || 'Terjadi kesalahan saat kompresi.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const handleDownload = () => {
    if (!resultData || !pdfFile) return;
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_compressed.pdf`;
    downloadBlob(resultData.compressedBytes, outName);
  };

  return (
    <section id="panel-compress-pdf" className="tab-panel space-y-4">
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
          <span className="text-emerald-400 text-xs font-bold font-mono uppercase tracking-wider">Kompres PDF</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload Dropzone */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-emerald-400 tracking-widest uppercase">Kompres Berkas PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Kecilkan ukuran file PDF Anda secara instan dan 100% offline langsung di peramban tanpa mengunggah ke server.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive ? 'border-emerald-500 bg-emerald-600/10' : 'border-white/10 bg-black/20 hover:border-emerald-500 hover:bg-emerald-600/10'
              }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-emerald-400">Klik untuk memilih berkas PDF</div>
                <div className="text-[10px] text-white/40">Mendukung semua ukuran berkas PDF</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Options & Compression Execution */
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-6">

            {/* File Metadata Card */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>
                  {pdfFile.name}
                </h4>
                <div className="text-xs text-white/50 font-mono">
                  Ukuran Asli: <span className="text-emerald-400 font-semibold">{formatBytes(pdfFile.size)}</span> &bull; {numPages} Halaman
                </div>
              </div>
              <button
                onClick={resetAll}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Ganti File
              </button>
            </div>

            {/* Preset Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold font-mono tracking-widest text-white/50 uppercase">
                Tingkat Kompresi
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Extreme */}
                <div
                  onClick={() => setCompressLevel('extreme')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    compressLevel === 'extreme'
                      ? 'border-emerald-500 bg-emerald-600/20 shadow-lg shadow-emerald-950/40 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Ekstrim</span>
                    {compressLevel === 'extreme' && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    Ukuran terkecil, cocok untuk dokumen scan dengan rasio kompresi maksimal.
                  </p>
                </div>

                {/* Recommended */}
                <div
                  onClick={() => setCompressLevel('recommended')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    compressLevel === 'recommended'
                      ? 'border-emerald-500 bg-emerald-600/20 shadow-lg shadow-emerald-950/40 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-400">Rekomendasi</span>
                    {compressLevel === 'recommended' && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    Keseimbangan terbaik antara penghematan ukuran file dan kejelasan visual.
                  </p>
                </div>

                {/* Less */}
                <div
                  onClick={() => setCompressLevel('less')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    compressLevel === 'less'
                      ? 'border-emerald-500 bg-emerald-600/20 shadow-lg shadow-emerald-950/40 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Ringan</span>
                    {compressLevel === 'less' && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    Kualitas tertinggi, mengecilkan ukuran tanpa mengubah kejernihan grafis.
                  </p>
                </div>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunCompress}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Mulai Kompres PDF</span>
            </button>

            {/* Result Stats Banner */}
            {resultData && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold font-mono uppercase text-emerald-400 tracking-wider">
                      Hasil Kompresi Berhasil
                    </span>
                    <div className="text-lg font-extrabold text-white flex items-center gap-2">
                      <span>{formatBytes(resultData.newSize)}</span>
                      <span className="text-xs text-white/40 line-through font-normal">{formatBytes(resultData.origSize)}</span>
                    </div>
                  </div>
                  <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-mono font-extrabold px-3 py-1.5 rounded-lg">
                    Hemat {resultData.savedPercent}%
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Unduh File PDF Hasil Kompresi</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </section>
  );
}
