import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { addWatermarkToPdf } from '../js/pdfEngine.js';

export default function WatermarkPanel({ notify, setLoader, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);

  // Layout & Preview
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.0);

  // Watermarks list
  const [watermarks, setWatermarks] = useState([]);
  const [activeWmId, setActiveWmId] = useState(null);
  const [pageRange, setPageRange] = useState('all'); // 'all' | 'first'

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageUploadRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Storing percentage layout for responsive zoom scaling
  const pctWatermarksRef = useRef({}); // id -> { leftPercent, topPercent }
  const isInteractingRef = useRef(false);

  // Load PDF file
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
      setWatermarks([]);
      pctWatermarksRef.current = {};
      notify('success', 'PDF Dimuat', 'Atur tanda air (watermark) Anda menggunakan panel samping.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Memuat', 'Berkas PDF rusak atau terenkripsi.');
      resetAll();
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  // Render PDF page canvas
  useEffect(() => {
    if (!pdfDoc) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        // Calculate responsive fits
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

  // Adjust coordinates proportionally when zoom level / overlaySize changes
  useEffect(() => {
    if (overlaySize.width === 0 || overlaySize.height === 0) return;

    setWatermarks((prevWms) =>
      prevWms.map((wm) => {
        const pct = pctWatermarksRef.current[wm.id];
        if (!pct) return wm;

        const newLeft = pct.leftPercent * overlaySize.width;
        const newTop = pct.topPercent * overlaySize.height;

        if (wm.type === 'text') {
          return {
            ...wm,
            left: newLeft,
            top: newTop,
          };
        } else {
          // Adjust visual size
          const newWidth = 120 * wm.imageScale * zoom;
          const newHeight = Math.round(newWidth / (wm.aspect || 1));
          return {
            ...wm,
            left: newLeft,
            top: newTop,
            width: newWidth,
            height: newHeight,
          };
        }
      })
    );
  }, [overlaySize]);

  // Add text watermark
  const addTextWatermark = () => {
    const id = `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const initialLeft = (overlaySize.width - 150) / 2 || 100;
    const initialTop = (overlaySize.height - 40) / 2 || 150;

    const newWm = {
      id,
      type: 'text',
      text: 'CONFIDENTIAL',
      fontSize: 36,
      color: '#f43f5e',
      opacity: 0.3,
      rotation: -30,
      position: 'free', // 'free' | 'tiled'
      gridCols: 3,
      gridRows: 4,
      left: initialLeft,
      top: initialTop,
    };

    pctWatermarksRef.current[id] = {
      leftPercent: initialLeft / (overlaySize.width || 1),
      topPercent: initialTop / (overlaySize.height || 1),
    };

    setWatermarks(prev => [...prev, newWm]);
    setActiveWmId(id);
    notify('success', 'Watermark Teks Ditambah', 'Geser tanda air ke posisi yang diinginkan.');
  };

  // Trigger image upload
  const triggerImageUpload = () => {
    if (imageUploadRef.current) imageUploadRef.current.click();
  };

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        notify('error', 'Format Salah', 'Tolong unggah berkas gambar (PNG/JPG).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const id = `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const aspect = img.width / img.height;
          const initialWidth = 120;
          const initialHeight = Math.round(initialWidth / aspect);
          const initialLeft = (overlaySize.width - initialWidth) / 2 || 100;
          const initialTop = (overlaySize.height - initialHeight) / 2 || 150;

          const newWm = {
            id,
            type: 'image',
            file,
            url: event.target.result,
            imageScale: 1.0,
            opacity: 0.3,
            rotation: 0,
            position: 'free',
            gridCols: 3,
            gridRows: 4,
            left: initialLeft,
            top: initialTop,
            width: initialWidth,
            height: initialHeight,
            aspect,
          };

          pctWatermarksRef.current[id] = {
            leftPercent: initialLeft / (overlaySize.width || 1),
            topPercent: initialTop / (overlaySize.height || 1),
          };

          setWatermarks(prev => [...prev, newWm]);
          setActiveWmId(id);
          notify('success', 'Watermark Gambar Ditambah', 'Sesuaikan posisi gambar pada halaman.');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and Drop event handlers (smooth direct DOM manipulation)
  const handleDragStart = (e, wmId) => {
    const wmItem = watermarks.find(w => w.id === wmId);
    if (!wmItem || wmItem.position === 'tiled') return;

    e.preventDefault();
    e.stopPropagation();
    setActiveWmId(wmId);
    isInteractingRef.current = true;

    const element = document.getElementById(`wm_el_${wmId}`);
    if (!element || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const styleLeft = parseFloat(element.style.left || '0');
    const styleTop = parseFloat(element.style.top || '0');

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;

    const offsetX = mouseX - styleLeft;
    const offsetY = mouseY - styleTop;

    const handleDragMove = (moveEvent) => {
      const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const curMouseX = curX - containerRect.left;
      const curMouseY = curY - containerRect.top;

      let newLeft = curMouseX - offsetX;
      let newTop = curMouseY - offsetY;

      // Bound restricts inside page container
      const maxLeft = containerRect.width - element.offsetWidth;
      const maxTop = containerRect.height - element.offsetHeight;

      newLeft = Math.max(0, Math.min(maxLeft, newLeft));
      newTop = Math.max(0, Math.min(maxTop, newTop));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;

      element.dataset.left = newLeft;
      element.dataset.top = newTop;
    };

    const handleDragEnd = () => {
      isInteractingRef.current = false;
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);

      const finalLeft = parseFloat(element.dataset.left ?? element.style.left);
      const finalTop = parseFloat(element.dataset.top ?? element.style.top);

      setWatermarks((prev) =>
        prev.map((item) =>
          item.id === wmId ? { ...item, left: finalLeft, top: finalTop } : item
        )
      );

      if (overlaySize.width > 0 && overlaySize.height > 0) {
        pctWatermarksRef.current[wmId] = {
          leftPercent: finalLeft / overlaySize.width,
          topPercent: finalTop / overlaySize.height,
        };
      }
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  };

  // Update properties of active watermark
  const updateActiveText = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, text: val } : w));
  };

  const updateActiveFontSize = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, fontSize: parseInt(val) } : w));
  };

  const updateActiveColor = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, color: val } : w));
  };

  const updateActiveImageScale = (val) => {
    const scaleVal = parseFloat(val);
    setWatermarks(prev => prev.map(w => {
      if (w.id === activeWmId) {
        const newWidth = 120 * scaleVal * zoom;
        const newHeight = Math.round(newWidth / (w.aspect || 1));
        return { ...w, imageScale: scaleVal, width: newWidth, height: newHeight };
      }
      return w;
    }));
  };

  const updateActiveOpacity = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, opacity: parseFloat(val) } : w));
  };

  const updateActiveRotation = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, rotation: parseInt(val) } : w));
  };

  const updateActivePosition = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, position: val } : w));
  };

  const updateActiveGridCols = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, gridCols: parseInt(val) } : w));
  };

  const updateActiveGridRows = (val) => {
    setWatermarks(prev => prev.map(w => w.id === activeWmId ? { ...w, gridRows: parseInt(val) } : w));
  };

  // Delete active watermark
  const deleteActiveWatermark = (id) => {
    const targetId = id || activeWmId;
    if (!targetId) return;

    setWatermarks(prev => prev.filter(w => w.id !== targetId));
    delete pctWatermarksRef.current[targetId];
    if (activeWmId === targetId) {
      setActiveWmId(null);
    }
    notify('success', 'Watermark Dihapus', 'Elemen berhasil dibersihkan.');
  };

  // Clean workspace reset
  const resetAll = () => {
    setPdfFile(null);
    setPdfDoc(null);
    setWatermarks([]);
    pctWatermarksRef.current = {};
    setActiveWmId(null);
    setPageRange('all');
    setZoom(1.0);
    setPageNumber(1);
    setNumPages(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageUploadRef.current) imageUploadRef.current.value = '';
  };

  // Drag helpers
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

  // Apply watermarks and save
  const handleSave = async () => {
    if (!pdfFile) return;
    if (watermarks.length === 0) {
      notify('error', 'Kosong', 'Harap tambahkan minimal 1 watermark terlebih dahulu.');
      return;
    }

    setLoader({ show: true, title: 'Menyematkan Watermark', message: 'Membuat dokumen PDF ber-watermark...', progress: 40 });

    try {
      // Calculate scales to convert visual layout to PDF points
      const scaleX = pageDimensions.width / overlaySize.width;
      const scaleY = pageDimensions.height / overlaySize.height;

      const preparedWatermarks = watermarks.map((wm) => {
        // Position conversions
        if (wm.position === 'tiled') {
          return {
            id: wm.id,
            type: wm.type,
            text: wm.text,
            fontSize: wm.fontSize,
            color: wm.color,
            file: wm.file,
            imageScale: wm.imageScale,
            opacity: wm.opacity,
            rotation: wm.rotation,
            position: 'tiled',
          };
        } else {
          // Free layout (convert visual screen top-left to PDF bottom-left points)
          const embedX = wm.left * scaleX;
          const visualHeight = wm.type === 'text' ? (wm.fontSize * 0.8) : (wm.height || 40);
          const embedY = (overlaySize.height - wm.top - visualHeight) * scaleY;

          return {
            id: wm.id,
            type: wm.type,
            text: wm.text,
            fontSize: wm.fontSize,
            color: wm.color,
            file: wm.file,
            imageScale: wm.imageScale,
            opacity: wm.opacity,
            rotation: wm.rotation,
            position: 'free',
            x: embedX,
            y: embedY,
            width: (wm.width || 120) * scaleX,
            height: (wm.height || 40) * scaleY,
          };
        }
      });

      const resultBytes = await addWatermarkToPdf(pdfFile, preparedWatermarks, { pageRange });

      const originalShort = pdfFile.name.replace('.pdf', '');
      const downloadName = `${originalShort}_watermarked.pdf`;

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

      notify('success', 'Berhasil Disimpan', 'Semua watermark berhasil disematkan ke PDF.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Menyimpan', err.message || 'Terjadi kesalahan saat mengekspor dokumen.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const activeWm = watermarks.find(w => w.id === activeWmId);

  return (
    <section id="panel-watermark" className="tab-panel space-y-4">
      {/* Navigation Breadcrumb */}
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
          <span className="text-amber-400 text-xs font-bold font-mono uppercase tracking-wider">Watermark PDF</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload PDF */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-amber-400 tracking-widest uppercase">Langkah 1: Unggah Berkas PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Silakan pilih berkas PDF yang ingin disematkan tanda air/watermark secara lokal.
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
                  ? 'border-amber-500 bg-amber-600/10'
                  : 'border-white/10 bg-black/20 hover:border-amber-500 hover:bg-amber-600/10'
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
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-400 group-hover:text-amber-350 transition-colors">
                    Klik untuk pilih berkas PDF
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Watermark Layout Settings */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Settings Sidebar (Left) */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 sm:space-y-6">
            
            {/* File Info */}
            <div className="space-y-1 pb-3 border-b border-white/5">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Dokumen PDF</span>
              <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>{pdfFile.name}</h4>
              <p className="text-xs text-amber-400 font-mono">{formatBytes(pdfFile.size)} &bull; {numPages} Hal</p>
            </div>

            {/* Toolbar Buttons */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Tambah Watermark</span>
              {watermarks.some(w => w.position === 'tiled') ? (
                <div className="text-[10px] font-semibold text-amber-400 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl leading-relaxed">
                  Pola Ubin (Tiled) sedang aktif. Hapus atau ubah posisi ubin ke Bebas untuk menambahkan watermark lainnya.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={addTextWatermark}
                    className="flex items-center justify-center space-x-2 py-2.5 bg-black/25 border border-white/10 hover:border-amber-500/50 hover:bg-amber-600/5 rounded-xl transition-all cursor-pointer group text-xs text-white/80 hover:text-white"
                  >
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Teks</span>
                  </button>

                  <button
                    onClick={triggerImageUpload}
                    className="flex items-center justify-center space-x-2 py-2.5 bg-black/25 border border-white/10 hover:border-amber-500/50 hover:bg-amber-600/5 rounded-xl transition-all cursor-pointer group text-xs text-white/80 hover:text-white"
                  >
                    <input
                      type="file"
                      ref={imageUploadRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1" />
                    </svg>
                    <span>Gambar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Custom Settings Pane (Active Watermark) */}
            {activeWm && (
              <div className="space-y-4 pt-4 border-t border-white/5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Atur Elemen</span>
                  <button
                    onClick={() => deleteActiveWatermark()}
                    className="text-[10px] text-red-400 font-bold hover:underline"
                  >
                    Hapus
                  </button>
                </div>

                {/* 1. TEXT SETTINGS */}
                {activeWm.type === 'text' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-white/60">Isi Teks</label>
                      <input
                        type="text"
                        value={activeWm.text}
                        onChange={(e) => updateActiveText(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-semibold text-white/60">Ukuran Font</label>
                        <span className="text-[10px] font-bold text-amber-400 font-mono">{activeWm.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="96"
                        value={activeWm.fontSize}
                        onChange={(e) => updateActiveFontSize(e.target.value)}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-white/60 font-mono">Warna Teks</label>
                      <div className="flex items-center space-x-2">
                        {['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#000000', '#ffffff'].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateActiveColor(c)}
                            style={{ backgroundColor: c }}
                            className={`h-5 w-5 rounded-full border transition-all ${
                              activeWm.color === c ? 'border-amber-400 scale-110 shadow-md shadow-amber-900/40' : 'border-white/10 hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. IMAGE SETTINGS */}
                {activeWm.type === 'image' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-semibold text-white/60">Skala Ukuran</label>
                        <span className="text-[10px] font-bold text-amber-400 font-mono">{Math.round(activeWm.imageScale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={activeWm.imageScale * 100}
                        onChange={(e) => updateActiveImageScale(parseFloat(e.target.value) / 100)}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* 3. COMMON CONTROLS */}
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-white/60">Jenis Letak Posisi</label>
                    <select
                      value={activeWm.position}
                      onChange={(e) => updateActivePosition(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:border-amber-500 focus:outline-none font-medium"
                    >
                      <option value="free">Bebas (Dapat Diseret)</option>
                      <option value="tiled" disabled={watermarks.length > 1}>
                        Ubin (Pola Berulang/Tiled) {watermarks.length > 1 ? "⚠️" : ""}
                      </option>
                    </select>
                    {watermarks.length > 1 && (
                      <p className="text-[9px] text-amber-450 leading-relaxed pt-0.5">
                        * Pola ubin hanya bisa diaktifkan jika jumlah watermark adalah 1.
                      </p>
                    )}
                  </div>

                  {activeWm.position === 'tiled' && (
                    <div className="space-y-3 pt-2 border-t border-white/5 animate-fadeIn">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] font-semibold text-white/60">Jumlah Kolom Ubin</label>
                          <span className="text-[10px] font-bold text-amber-400 font-mono">{activeWm.gridCols || 3}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="8"
                          value={activeWm.gridCols || 3}
                          onChange={(e) => updateActiveGridCols(e.target.value)}
                          className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] font-semibold text-white/60">Jumlah Baris Ubin</label>
                          <span className="text-[10px] font-bold text-amber-400 font-mono">{activeWm.gridRows || 4}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={activeWm.gridRows || 4}
                          onChange={(e) => updateActiveGridRows(e.target.value)}
                          className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-semibold text-white/60">Transparansi (Opacity)</label>
                      <span className="text-[10px] font-bold text-amber-400 font-mono">{Math.round(activeWm.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={activeWm.opacity * 100}
                      onChange={(e) => updateActiveOpacity(parseFloat(e.target.value) / 100)}
                      className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-semibold text-white/60">Rotasi Kemiringan</label>
                      <span className="text-[10px] font-bold text-amber-400 font-mono">{activeWm.rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      value={activeWm.rotation}
                      onChange={(e) => updateActiveRotation(e.target.value)}
                      className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Global Options */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Cakupan Dokumen</span>
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-white/60">Terapkan Pada</label>
                <select
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="all">Semua Halaman</option>
                  <option value="first">Halaman Pertama Saja</option>
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <button
                onClick={handleSave}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-amber-900/40"
              >
                <span>Terapkan &amp; Unduh PDF</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              <button
                onClick={resetAll}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center"
              >
                Tutup Dokumen
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="pt-3 border-t border-white/5 space-y-2">
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

          {/* Canvas Workspace Viewport (Right) */}
          <div 
            onClick={() => setActiveWmId(null)}
            className="lg:col-span-2 flex flex-col p-2 sm:p-4 bg-black/25 border border-white/10 rounded-2xl min-h-[250px] sm:min-h-[400px] overflow-auto select-none"
          >
            
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

                {/* Watermarks layer */}
                {watermarks.map((wm) => {
                  const isActive = wm.id === activeWmId;
                  
                  if (wm.position === 'tiled') {
                    // Pattern repeat overlay
                    const gridCols = wm.gridCols || 3;
                    const gridRows = wm.gridRows || 4;
                    const totalTiles = gridCols * gridRows;

                    return (
                      <div 
                        key={wm.id}
                        onClick={(e) => { e.stopPropagation(); setActiveWmId(wm.id); }}
                        className={`absolute inset-0 grid p-4 gap-4 overflow-hidden border cursor-pointer pointer-events-auto ${
                          isActive ? 'border-amber-500 bg-amber-600/5' : 'border-transparent'
                        }`}
                        style={{
                          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                          zIndex: isActive ? 30 : 15,
                        }}
                      >
                        {Array.from({ length: totalTiles }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center">
                            {wm.type === 'text' ? (
                              <span
                                style={{
                                  fontFamily: 'Helvetica, Arial, sans-serif',
                                  fontSize: `${Math.max(10, wm.fontSize * 0.4) * zoom}px`,
                                  color: wm.color,
                                  fontWeight: 'extrabold',
                                  opacity: wm.opacity,
                                  whiteSpace: 'nowrap',
                                  pointerEvents: 'none',
                                  transform: `rotate(${wm.rotation}deg)`,
                                }}
                              >
                                {wm.text}
                              </span>
                            ) : (
                              <img
                                src={wm.url}
                                style={{
                                  width: `${40 * wm.imageScale * zoom}px`,
                                  height: 'auto',
                                  opacity: wm.opacity,
                                  pointerEvents: 'none',
                                  transform: `rotate(${wm.rotation}deg)`,
                                }}
                                alt="Watermark tile"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Free drag layout
                  return (
                    <div
                      key={wm.id}
                      id={`wm_el_${wm.id}`}
                      onMouseDown={(e) => handleDragStart(e, wm.id)}
                      onTouchStart={(e) => handleDragStart(e, wm.id)}
                      style={{
                        position: 'absolute',
                        left: `${wm.left}px`,
                        top: `${wm.top}px`,
                        width: wm.type === 'text' ? 'auto' : `${wm.width}px`,
                        height: wm.type === 'text' ? 'auto' : `${wm.height}px`,
                        cursor: 'move',
                        border: isActive ? '2px dashed #f59e0b' : '2px dashed transparent',
                        backgroundColor: isActive ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                        userSelect: 'none',
                        touchAction: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: wm.type === 'text' ? '4px 8px' : '0px',
                        borderRadius: '4px',
                        zIndex: isActive ? 40 : 20,
                        transform: `rotate(${wm.rotation}deg)`,
                        transformOrigin: 'center center',
                      }}
                    >
                      {/* Text watermark content */}
                      {wm.type === 'text' && (
                        <span
                          style={{
                            fontFamily: 'Helvetica, Arial, sans-serif',
                            fontSize: `${wm.fontSize * zoom}px`,
                            color: wm.color,
                            fontWeight: 'extrabold',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            opacity: wm.opacity,
                          }}
                        >
                          {wm.text}
                        </span>
                      )}

                      {/* Image watermark content */}
                      {wm.type === 'image' && (
                        <img
                          src={wm.url}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            pointerEvents: 'none',
                            opacity: wm.opacity,
                          }}
                          alt="Logo watermark"
                        />
                      )}

                      {/* Delete button (when selected) */}
                      {isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteActiveWatermark(wm.id); }}
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '-10px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #ffffff',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            zIndex: 50,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          }}
                          title="Hapus"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
