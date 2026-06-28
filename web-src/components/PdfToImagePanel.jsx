import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfPageToImageBlob } from '../js/pdfEngine.js';

const PDFJS_VERSION = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export default function PdfToImagePanel({ notify, setLoader, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [thumbnails, setThumbnails] = useState([]); // [{pageNumber, dataUrl}]
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Export settings
  const [format, setFormat] = useState('png');        // 'png' | 'jpeg' | 'webp'
  const [quality, setQuality] = useState(92);         // 1–100
  const [scale, setScale] = useState(2);              // 1 | 2 | 3
  const [pageMode, setPageMode] = useState('all');    // 'all' | 'odd' | 'even' | 'manual'

  // --- File Loading ---
  const loadPdfFile = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Harap masukkan berkas PDF.');
      return;
    }
    setLoader({ show: true, title: 'Membaca PDF', message: 'Memuat halaman...', progress: 10 });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPdfFile(file);
      setNumPages(doc.numPages);
      setSelectedPages(new Set());
      setThumbnails([]);

      // Generate thumbnails
      const thumbs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        setLoader({ show: true, title: 'Membaca PDF', message: `Membuat pratinjau halaman ${i}/${doc.numPages}...`, progress: Math.round(10 + (i / doc.numPages) * 80) });
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.push({ pageNumber: i, dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
      }

      setThumbnails(thumbs);
      // Default: select all
      setSelectedPages(new Set(thumbs.map(t => t.pageNumber)));
      notify('success', 'PDF Dimuat', `${doc.numPages} halaman siap dikonversi menjadi gambar.`);
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
    setPdfDoc(null);
    setNumPages(0);
    setThumbnails([]);
    setSelectedPages(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Page Selection ---
  const togglePage = (pageNumber) => {
    if (pageMode !== 'manual') setPageMode('manual');
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  };

  const selectAll = () => {
    setPageMode('all');
    setSelectedPages(new Set(thumbnails.map(t => t.pageNumber)));
  };

  const deselectAll = () => {
    setPageMode('manual');
    setSelectedPages(new Set());
  };

  // Sync page selection based on pageMode (all/odd/even)
  useEffect(() => {
    if (thumbnails.length === 0) return;
    if (pageMode === 'all') {
      setSelectedPages(new Set(thumbnails.map(t => t.pageNumber)));
    } else if (pageMode === 'odd') {
      setSelectedPages(new Set(thumbnails.filter(t => t.pageNumber % 2 === 1).map(t => t.pageNumber)));
    } else if (pageMode === 'even') {
      setSelectedPages(new Set(thumbnails.filter(t => t.pageNumber % 2 === 0).map(t => t.pageNumber)));
    }
    // 'manual' handled by togglePage
  }, [pageMode, thumbnails.length]);

  // --- Conversion & Download ---
  const handleConvert = async () => {
    if (!pdfFile) return;
    if (selectedPages.size === 0) {
      notify('error', 'Tidak Ada Halaman', 'Pilih minimal 1 halaman untuk dikonversi.');
      return;
    }

    const sortedPages = [...selectedPages].sort((a, b) => a - b);
    const ext = format === 'jpeg' ? 'jpg' : format;
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');

    setLoader({ show: true, title: 'Mengonversi', message: `Memproses halaman 1/${sortedPages.length}...`, progress: 5 });

    try {
      const zip = new JSZip();
      const imgFolder = zip.folder('gambar_pdf');

      for (let idx = 0; idx < sortedPages.length; idx++) {
        const pageNum = sortedPages[idx];
        setLoader({
          show: true,
          title: 'Mengonversi ke Gambar',
          message: `Memroses halaman ${pageNum} (${idx + 1}/${sortedPages.length})...`,
          progress: Math.round(5 + (idx / sortedPages.length) * 85),
        });

        const blob = await pdfPageToImageBlob(pdfFile, pageNum, {
          format,
          quality: quality / 100,
          scale,
        });

        const fileName = `${baseName}_hal${String(pageNum).padStart(3, '0')}.${ext}`;
        imgFolder.file(fileName, blob);
      }

      setLoader({ show: true, title: 'Membuat ZIP', message: 'Mengemas semua gambar...', progress: 93 });
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_gambar.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);

      notify('success', 'Konversi Selesai', `${sortedPages.length} halaman berhasil diekspor ke dalam ZIP.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Konversi', err.message || 'Terjadi kesalahan saat konversi.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const scaleLabels = { 1: '72 DPI (Kecil)', 2: '144 DPI (Standar)', 3: '216 DPI (Tinggi)' };

  return (
    <section id="panel-pdf-to-image" className="tab-panel space-y-4">
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
          <span className="text-violet-400 text-xs font-bold font-mono uppercase tracking-wider">PDF ke Gambar</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-violet-400 tracking-widest uppercase">Unggah Berkas PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Pilih berkas PDF yang ingin dikonversi menjadi gambar. Semua proses berjalan lokal di browser Anda.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive ? 'border-violet-500 bg-violet-600/10' : 'border-white/10 bg-black/20 hover:border-violet-500 hover:bg-violet-600/10'
              }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-violet-400">Klik untuk pilih berkas PDF</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Settings + Preview */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Settings */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5">

            {/* File Info */}
            <div className="space-y-1 pb-3 border-b border-white/5">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Dokumen PDF</span>
              <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>{pdfFile.name}</h4>
              <p className="text-xs text-violet-400 font-mono">{formatBytes(pdfFile.size)} &bull; {numPages} Hal &bull; {selectedPages.size} Terpilih</p>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Format Output</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: 'png', label: 'PNG', desc: 'Lossless' },
                  { value: 'jpeg', label: 'JPG', desc: 'Kecil' },
                  { value: 'webp', label: 'WebP', desc: 'Modern' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`py-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all text-center ${
                      format === opt.value
                        ? 'bg-violet-600 border-violet-400 text-white shadow-lg shadow-violet-900/30'
                        : 'bg-black/25 border-white/10 text-white/60 hover:border-violet-500/50 hover:text-white'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[8px] font-normal opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality (for jpg/webp) */}
            {(format === 'jpeg' || format === 'webp') && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-semibold text-white/60">Kualitas Gambar</label>
                  <span className="text-[10px] font-bold text-violet-400 font-mono">{quality}%</span>
                </div>
                <input
                  type="range" min="40" max="100" value={quality}
                  onChange={e => setQuality(parseInt(e.target.value))}
                  className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[9px] text-white/30">
                  <span>Kecil</span><span>Terbaik</span>
                </div>
              </div>
            )}

            {/* Scale / Resolution */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Resolusi Output</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map(s => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`py-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all text-center ${
                      scale === s
                        ? 'bg-violet-600 border-violet-400 text-white shadow-lg shadow-violet-900/30'
                        : 'bg-black/25 border-white/10 text-white/60 hover:border-violet-500/50 hover:text-white'
                    }`}
                  >
                    <div>{s}x</div>
                    <div className="text-[8px] font-normal opacity-70">{s * 72} dpi</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Page Mode */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Cakupan Halaman</label>
              <select
                value={pageMode}
                onChange={e => setPageMode(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="all">Semua Halaman</option>
                <option value="odd">Halaman Ganjil</option>
                <option value="even">Halaman Genap</option>
                <option value="manual">Pilih Manual (klik thumbnail)</option>
              </select>
            </div>

            {/* Convert button */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <button
                onClick={handleConvert}
                disabled={selectedPages.size === 0}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-violet-900/40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Konversi &amp; Unduh ZIP ({selectedPages.size} hal)</span>
              </button>

              <button
                onClick={resetAll}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center"
              >
                Tutup Dokumen
              </button>
            </div>
          </div>

          {/* Right: Thumbnail Grid */}
          <div className="lg:col-span-2 bg-black/25 border border-white/10 rounded-2xl p-4 space-y-4">

            {/* Grid header */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Pratinjau Halaman</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-bold cursor-pointer transition-colors"
                >
                  Pilih Semua
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={deselectAll}
                  className="text-[10px] text-white/50 hover:text-white font-bold cursor-pointer transition-colors"
                >
                  Batal Semua
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            {thumbnails.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-white/30 text-xs">
                Memuat pratinjau...
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
                {thumbnails.map(({ pageNumber, dataUrl }) => {
                  const isSelected = selectedPages.has(pageNumber);
                  return (
                    <div
                      key={pageNumber}
                      onClick={() => togglePage(pageNumber)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 group ${
                        isSelected
                          ? 'border-violet-500 shadow-lg shadow-violet-900/40 scale-[1.02]'
                          : 'border-white/10 hover:border-violet-500/50 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <img src={dataUrl} alt={`Hal. ${pageNumber}`} className="w-full h-auto block" />

                      {/* Page number badge */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent py-1.5 px-2">
                        <span className="text-[10px] text-white font-bold font-mono">Hal. {pageNumber}</span>
                      </div>

                      {/* Selection checkmark */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 h-5 w-5 bg-violet-500 rounded-full flex items-center justify-center shadow-md">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
}
