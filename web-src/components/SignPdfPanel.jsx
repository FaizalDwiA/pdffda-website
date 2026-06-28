import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { embedSignatureToPdf } from '../js/pdfEngine.js';

export default function SignPdfPanel({ notify, setLoader, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [sigFile, setSigFile] = useState(null);
  const [sigUrl, setSigUrl] = useState('');
  
  // PDF states
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.0);

  // Signature dimensions
  const [sigWidth, setSigWidth] = useState(120);
  const [sigHeight, setSigHeight] = useState(60);
  const aspectRef = useRef(2); // width / height

  // Refs for smooth drag
  const canvasRef = useRef(null);
  const sigRef = useRef(null);
  const containerRef = useRef(null);
  const posRef = useRef({ left: 50, top: 50 }); // Track coords in ref to prevent React render lag
  const isDraggingRef = useRef(false);
  const sizeRef = useRef({ width: 120, height: 60 });
  const pctRef = useRef({ left: 50 / 550, top: 50 / 600, width: 120 / 550 });

  const [isHovered, setIsHovered] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const fileInputRef = useRef(null);
  const sigInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await loadPdfFile(e.dataTransfer.files[0]);
    }
  };

  const [isSigDragActive, setIsSigDragActive] = useState(false);

  const handleSigDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsSigDragActive(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setIsSigDragActive(false);
    }
  };

  const handleSigDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSigDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadSignatureImage(e.dataTransfer.files[0]);
    }
  };

  // Load PDF file metadata
  const handlePdfChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await loadPdfFile(e.target.files[0]);
    }
  };

  const loadPdfFile = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Harap masukkan berkas PDF.');
      return;
    }
    setLoader({ show: true, title: 'Memuat PDF', message: 'Membuka dokumen...', progress: 20 });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPdfFile(file);
      setNumPages(doc.numPages);
      setPageNumber(1);
      notify('success', 'PDF Dimuat', 'Silakan unggah tanda tangan gambar Anda.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Memuat', 'Berkas PDF rusak atau terenkripsi.');
      resetAll();
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  // Load Signature Image
  const handleSigChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      loadSignatureImage(e.target.files[0]);
    }
  };

  const loadSignatureImage = (file) => {
    if (!file.type.startsWith('image/')) {
      notify('error', 'Format Salah', 'Tanda tangan harus berupa berkas gambar (PNG/JPG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        aspectRef.current = aspect;
        
        // Determine initial dimensions keeping aspect ratio
        const initialWidth = 120;
        const initialHeight = Math.round(initialWidth / aspect);
        setSigWidth(initialWidth);
        setSigHeight(initialHeight);
        sizeRef.current = { width: initialWidth, height: initialHeight };
        setSigUrl(event.target.result);
        setSigFile(file);

        // Reset positions
        const initialLeft = 50;
        const initialTop = 50;
        posRef.current = { left: initialLeft, top: initialTop };
        if (sigRef.current) {
          sigRef.current.style.left = `${initialLeft}px`;
          sigRef.current.style.top = `${initialTop}px`;
          sigRef.current.style.width = `${initialWidth}px`;
          sigRef.current.style.height = `${initialHeight}px`;
        }

        if (overlaySize.width > 0 && overlaySize.height > 0) {
          pctRef.current = {
            left: initialLeft / overlaySize.width,
            top: initialTop / overlaySize.height,
            width: initialWidth / overlaySize.width
          };
        }

        notify('success', 'Gambar Dimuat', 'Tanda tangan siap diposisikan.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Render PDF Page to Canvas
  useEffect(() => {
    if (!pdfDoc) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        // Calculate responsive scale
        const containerMaxWidth = Math.min(window.innerWidth - 48, 550);
        const baseScale = Math.min(containerMaxWidth / viewport.width, 600 / viewport.height);
        const finalScale = baseScale * zoom;
        const scaledViewport = page.getViewport({ scale: finalScale });

        setOverlaySize({ width: scaledViewport.width, height: scaledViewport.height });

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          const context = canvas.getContext('2d');
          
          // Render page background
          await page.render({
            canvasContext: context,
            viewport: scaledViewport
          }).promise;
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, zoom]);

  // Scale signature proportionally when canvas dimensions change (e.g. zoom)
  useEffect(() => {
    if (!sigFile || overlaySize.width === 0 || overlaySize.height === 0) return;

    const newLeft = pctRef.current.left * overlaySize.width;
    const newTop = pctRef.current.top * overlaySize.height;
    const newWidth = Math.max(30, Math.round(pctRef.current.width * overlaySize.width));
    const newHeight = Math.round(newWidth / aspectRef.current);

    posRef.current = { left: newLeft, top: newTop };
    sizeRef.current = { width: newWidth, height: newHeight };

    if (sigRef.current) {
      sigRef.current.style.left = `${newLeft}px`;
      sigRef.current.style.top = `${newTop}px`;
      sigRef.current.style.width = `${newWidth}px`;
      sigRef.current.style.height = `${newHeight}px`;
    }

    setSigWidth(newWidth);
    setSigHeight(newHeight);
  }, [overlaySize, sigFile]);

  // Smooth dragging events (Direct DOM mutations for fluid 60 FPS movement)
  const handleDragStart = (clientX, clientY) => {
    if (!sigRef.current || !containerRef.current) return;
    
    isDraggingRef.current = true;
    setIsInteracting(true);
    const sigRect = sigRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Mouse offset relative to signature top-left
    const offsetX = clientX - sigRect.left;
    const offsetY = clientY - sigRect.top;

    const handleDragMove = (moveEvent) => {
      if (!isDraggingRef.current) return;

      const eX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const eY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let newLeft = eX - containerRect.left - offsetX;
      let newTop = eY - containerRect.top - offsetY;

      // Restrict drag bounds inside container
      const maxLeft = containerRect.width - sigWidth;
      const maxTop = containerRect.height - sigHeight;

      newLeft = Math.max(0, Math.min(maxLeft, newLeft));
      newTop = Math.max(0, Math.min(maxTop, newTop));

      // Direct DOM update (no state triggers)
      sigRef.current.style.left = `${newLeft}px`;
      sigRef.current.style.top = `${newTop}px`;
      posRef.current = { left: newLeft, top: newTop };
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      setIsInteracting(false);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);

      // Save percentage positions relative to canvas dimensions
      if (overlaySize.width > 0 && overlaySize.height > 0) {
        pctRef.current = {
          left: posRef.current.left / overlaySize.width,
          top: posRef.current.top / overlaySize.height,
          width: sigWidth / overlaySize.width
        };
      }
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleResizeStart = (clientX, clientY) => {
    if (!sigRef.current || !containerRef.current) return;
    
    isDraggingRef.current = true;
    setIsInteracting(true);
    const containerRect = containerRef.current.getBoundingClientRect();
    
    const initialWidth = sigWidth;
    const startX = clientX;

    const handleResizeMove = (moveEvent) => {
      const eX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = eX - startX;
      
      let newWidth = initialWidth + deltaX;

      // Restrict resize within canvas boundaries
      const currentLeft = posRef.current.left;
      const maxWidth = containerRect.width - currentLeft;

      newWidth = Math.max(30, Math.min(maxWidth, newWidth));
      const newHeight = Math.round(newWidth / aspectRef.current);

      // Direct DOM update (no React rendering triggers during drag)
      sigRef.current.style.width = `${newWidth}px`;
      sigRef.current.style.height = `${newHeight}px`;
      sizeRef.current = { width: newWidth, height: newHeight };
    };

    const handleResizeEnd = () => {
      isDraggingRef.current = false;
      setIsInteracting(false);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);

      // Commit final size to React state
      setSigWidth(sizeRef.current.width);
      setSigHeight(sizeRef.current.height);

      // Save percentage dimensions relative to canvas dimensions
      if (overlaySize.width > 0 && overlaySize.height > 0) {
        pctRef.current = {
          left: posRef.current.left / overlaySize.width,
          top: posRef.current.top / overlaySize.height,
          width: sizeRef.current.width / overlaySize.width
        };
      }
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('touchend', handleResizeEnd);
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleResizeStart(e.clientX, e.clientY);
  };

  const handleResizeTouchStart = (e) => {
    e.stopPropagation();
    if (e.touches && e.touches[0]) {
      handleResizeStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleSizeChange = (e) => {
    const newWidth = parseInt(e.target.value);
    const newHeight = Math.round(newWidth / aspectRef.current);
    setSigWidth(newWidth);
    setSigHeight(newHeight);
    sizeRef.current = { width: newWidth, height: newHeight };

    if (overlaySize.width > 0 && overlaySize.height > 0) {
      pctRef.current.width = newWidth / overlaySize.width;
    }
  };

  const handleSave = async () => {
    if (!pdfFile || !sigFile) return;

    setLoader({ show: true, title: 'Menyematkan Tanda Tangan', message: 'Memproses penempatan gambar...', progress: 40 });

    try {
      // Calculate conversion scale ratio from screen preview to actual PDF points
      const scaleX = pageDimensions.width / overlaySize.width;
      const scaleY = pageDimensions.height / overlaySize.height;

      const embedX = posRef.current.left * scaleX;
      // Invert Y axis: PDF points are measured from bottom-left corner
      const embedY = (overlaySize.height - posRef.current.top - sigHeight) * scaleY;
      const embedWidth = sigWidth * scaleX;
      const embedHeight = sigHeight * scaleY;

      const resultBytes = await embedSignatureToPdf(pdfFile, sigFile, {
        pageIndex: pageNumber - 1,
        x: embedX,
        y: embedY,
        width: embedWidth,
        height: embedHeight,
      });

      const originalShort = pdfFile.name.replace('.pdf', '');
      const downloadName = `${originalShort}_signed.pdf`;

      // Download file
      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = downloadUrl;
      tempLink.download = downloadName;
      document.body.appendChild(tempLink);
      tempLink.click();

      setTimeout(() => {
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(downloadUrl);
      }, 300);

      notify('success', 'Berhasil', 'Tanda tangan disematkan. Berkas terunduh otomatis.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal', err.message || 'Terjadi kesalahan sistem menyematkan gambar.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const resetAll = () => {
    setPdfFile(null);
    setPdfDoc(null);
    setSigFile(null);
    setSigUrl('');
    setNumPages(1);
    setPageNumber(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (sigInputRef.current) sigInputRef.current.value = '';
  };

  return (
    <section id="panel-sign" className="tab-panel space-y-6">
      {/* Back Navigation Bar */}
      <div className="flex items-center space-x-3 pb-2">
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
        <span className="text-rose-400 text-xs font-bold font-mono uppercase tracking-wider">Tanda Tangani PDF</span>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload PDF */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-rose-400 tracking-widest uppercase">Langkah 1: Pilih Berkas PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Silakan unggah dokumen PDF yang ingin Anda bubuhkan tanda tangan gambar secara offline.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive
                  ? 'border-rose-500 bg-rose-600/10'
                  : 'border-white/10 bg-black/20 hover:border-rose-500 hover:bg-rose-600/10'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/pdf"
                onChange={handlePdfChange}
              />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-rose-400 group-hover:text-rose-300 transition-colors">
                    Klik untuk pilih berkas PDF
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2 & Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column (Left) */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 sm:space-y-6">
            
            {/* File Info */}
            <div className="space-y-1 pb-4 border-b border-white/5">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Dokumen PDF</span>
              <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>{pdfFile.name}</h4>
              <p className="text-xs text-rose-400 font-mono">{formatBytes(pdfFile.size)} &bull; {numPages} Hal</p>
            </div>

            {/* Signature Upload */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Unggah Tanda Tangan</span>
              
              {!sigFile ? (
                <div 
                  onDragEnter={handleSigDrag}
                  onDragOver={handleSigDrag}
                  onDragLeave={handleSigDrag}
                  onDrop={handleSigDrop}
                  onClick={() => sigInputRef.current.click()}
                  className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    isSigDragActive 
                      ? 'border-rose-500 bg-rose-600/10'
                      : 'border-white/10 bg-black/20 hover:border-rose-500/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={sigInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleSigChange}
                  />
                  <svg className="mx-auto h-8 w-8 text-white/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1" />
                  </svg>
                  <span className="block text-xs font-semibold text-rose-400">Pilih Gambar TTD (PNG/JPG)</span>
                </div>
              ) : (
                <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <img src={sigUrl} className="h-8 w-8 object-contain bg-white/5 rounded border border-white/10" />
                    <span className="text-xs text-white/80 font-medium truncate" title={sigFile.name}>{sigFile.name}</span>
                  </div>
                  <button 
                    onClick={() => { setSigFile(null); setSigUrl(''); }}
                    className="p-1 hover:bg-white/5 rounded-lg text-red-400 transition-colors"
                    title="Hapus"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Slider Resizer & Page Selector (Only visible if signature uploaded) */}
            {sigFile && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                
                {/* Page Navigator */}
                {numPages > 1 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-white/70">Pilih Halaman Target</label>
                    <div className="flex items-center justify-between bg-black/20 rounded-xl px-2 py-1.5 border border-white/10">
                      <button
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber === 1}
                        className="p-1 hover:bg-white/5 rounded text-white/60 disabled:opacity-30 cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-xs font-bold text-white font-mono">{pageNumber} / {numPages}</span>
                      <button
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber === numPages}
                        className="p-1 hover:bg-white/5 rounded text-white/60 disabled:opacity-30 cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Slider resize width */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/70">Lebar Tanda Tangan</label>
                    <span className="text-xs text-rose-400 font-bold font-mono">{sigWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="300"
                    value={sigWidth}
                    onChange={handleSizeChange}
                    className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>

                {/* Action trigger embed */}
                <div className="pt-4">
                  <button
                    onClick={handleSave}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-rose-900/40"
                  >
                    <span>Sematkan &amp; Unduh PDF</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={resetAll}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center"
              >
                Tutup Dokumen
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="pt-4 border-t border-white/5 space-y-2">
              <label className="block text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Zoom Dokumen</label>
              <div className="flex items-center justify-between bg-black/25 rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
                  className="p-1.5 hover:bg-white/10 active:scale-95 rounded text-white/80 transition-all cursor-pointer font-bold text-xs"
                  title="Zoom Out"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-white text-xs font-mono font-bold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
                  className="p-1.5 hover:bg-white/10 active:scale-95 rounded text-white/80 transition-all cursor-pointer font-bold text-xs"
                  title="Zoom In"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => setZoom(1.0)}
                  className="p-1.5 hover:bg-white/10 active:scale-95 rounded text-white/60 hover:text-white transition-all cursor-pointer font-bold text-xs border-l border-white/5 pl-1.5"
                  title="Reset Zoom"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 16.002H18a5 5 0 00-5-5H4" />
                  </svg>
                </button>
              </div>
            </div>

          </div>

          {/* Interactive Workspace (Right / Center) */}
          <div className="lg:col-span-2 flex flex-col p-2 sm:p-4 bg-black/25 border border-white/10 rounded-2xl min-h-[250px] sm:min-h-[400px] overflow-auto select-none">
            
            <div className="m-auto flex flex-col items-center justify-center">
              {/* Visual preview viewport wrapping box */}
              <div 
                ref={containerRef}
                style={{
                  position: 'relative',
                  width: `${overlaySize.width}px`,
                  height: `${overlaySize.height}px`,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
              >

                {/* PDF.js canvas background */}
                <canvas 
                  ref={canvasRef} 
                  style={{ 
                    display: 'block',
                    width: `${overlaySize.width}px`, 
                    height: `${overlaySize.height}px` 
                  }} 
                />

                {/* Absolute overlay container boundary */}
                {sigFile && sigUrl && (
                  <div
                    ref={sigRef}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{
                      position: 'absolute',
                      left: `${posRef.current.left}px`,
                      top: `${posRef.current.top}px`,
                      width: `${sigWidth}px`,
                      height: `${sigHeight}px`,
                      cursor: 'move',
                      border: (isHovered || isInteracting) ? '2px dashed #f43f5e' : '2px dashed transparent',
                      backgroundColor: (isHovered || isInteracting) ? 'rgba(244, 63, 94, 0.05)' : 'transparent',
                      userSelect: 'none',
                      touchAction: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    title="Seret tanda tangan ke posisi yang diinginkan"
                  >
                    <img 
                      src={sigUrl} 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        pointerEvents: 'none' 
                      }} 
                    />
                    {/* Circular corner resize handle */}
                    {(isHovered || isInteracting) && (
                      <div
                        onMouseDown={handleResizeMouseDown}
                        onTouchStart={handleResizeTouchStart}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          bottom: '-6px',
                          width: '12px',
                          height: '12px',
                          backgroundColor: '#f43f5e',
                          border: '2px solid #ffffff',
                          borderRadius: '50%',
                          cursor: 'se-resize',
                          zIndex: 30,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                        title="Seret pojok untuk memperbesar/kecil"
                      />
                    )}
                    {/* Subtle drag cue indicator */}
                    {(isHovered || isInteracting) && (
                      <div className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 shadow-md">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!sigFile && (
                <div className="text-center p-6 space-y-2 text-white/40">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <p className="text-xs font-semibold">Dokumen PDF Terbuka</p>
                  <p className="text-[10px] leading-relaxed max-w-xs">
                    Silakan pilih atau unggah berkas tanda tangan gambar Anda di kolom samping untuk memunculkan kotak seret tanda tangan.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
