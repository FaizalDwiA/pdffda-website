import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { saveEditedPdf } from '../js/pdfEngine.js';

export default function EditPdfPanel({ notify, setLoader, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  
  // Page navigation
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.0);

  // Edits list
  const [edits, setEdits] = useState([]);
  const [activeEditId, setActiveEditId] = useState(null);

  // Smooth movement refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Storing percentage layout for responsive zoom scaling
  const pctEditsRef = useRef({}); // id -> { leftPercent, topPercent, widthPercent }
  const isInteractingRef = useRef(false);

  const fileInputRef = useRef(null);
  const imageUploadRef = useRef(null);
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

  // Load PDF document
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
      setEdits([]);
      pctEditsRef.current = {};
      notify('success', 'PDF Dimuat', 'Gunakan toolbar di samping untuk mengedit berkas.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Memuat', 'Berkas PDF rusak atau terenkripsi.');
      resetAll();
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  // Render PDF page to canvas
  useEffect(() => {
    if (!pdfDoc) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        // Calculate base scale fitting preview container
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

    setEdits((prevEdits) =>
      prevEdits.map((edit) => {
        const pct = pctEditsRef.current[edit.id];
        if (!pct) return edit;

        const newLeft = pct.leftPercent * overlaySize.width;
        const newTop = pct.topPercent * overlaySize.height;

        if (edit.type === 'text') {
          return {
            ...edit,
            left: newLeft,
            top: newTop,
          };
        } else {
          const newWidth = Math.max(30, Math.round(pct.widthPercent * overlaySize.width));
          const newHeight = Math.round(newWidth / (edit.aspect || 1));
          return {
            ...edit,
            left: newLeft,
            top: newTop,
            width: newWidth,
            height: newHeight,
          };
        }
      })
    );
  }, [overlaySize]);

  // Add text annotation
  const addTextEdit = () => {
    const id = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const initialLeft = 50;
    const initialTop = 50;
    const initialFontSize = 16;

    const newEdit = {
      id,
      pageIndex: pageNumber - 1,
      type: 'text',
      text: 'Ketik di sini',
      fontSize: initialFontSize,
      color: '#000000',
      left: initialLeft,
      top: initialTop,
    };

    pctEditsRef.current[id] = {
      leftPercent: initialLeft / overlaySize.width,
      topPercent: initialTop / overlaySize.height,
      widthPercent: 0.2, // default placeholder
    };

    setEdits(prev => [...prev, newEdit]);
    setActiveEditId(id);
    notify('success', 'Teks Ditambahkan', 'Klik pada teks untuk mengedit atau menggesernya.');
  };

  // Add whiteout shape annotation
  const addWhiteoutEdit = () => {
    const id = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const initialLeft = 80;
    const initialTop = 80;
    const initialWidth = 100;
    const initialHeight = 30;

    const newEdit = {
      id,
      pageIndex: pageNumber - 1,
      type: 'whiteout',
      color: '#ffffff',
      left: initialLeft,
      top: initialTop,
      width: initialWidth,
      height: initialHeight,
      aspect: initialWidth / initialHeight,
    };

    pctEditsRef.current[id] = {
      leftPercent: initialLeft / overlaySize.width,
      topPercent: initialTop / overlaySize.height,
      widthPercent: initialWidth / overlaySize.width,
    };

    setEdits(prev => [...prev, newEdit]);
    setActiveEditId(id);
    notify('success', 'Sensor Ditambahkan', 'Seret pojok kotak untuk mengubah ukuran sensor.');
  };

  // Add custom image annotation
  const triggerImageUpload = () => {
    if (imageUploadRef.current) {
      imageUploadRef.current.click();
    }
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
          const id = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const aspect = img.width / img.height;
          const initialWidth = 100;
          const initialHeight = Math.round(initialWidth / aspect);
          const initialLeft = 100;
          const initialTop = 100;

          const newEdit = {
            id,
            pageIndex: pageNumber - 1,
            type: 'image',
            file,
            url: event.target.result,
            left: initialLeft,
            top: initialTop,
            width: initialWidth,
            height: initialHeight,
            aspect,
          };

          pctEditsRef.current[id] = {
            leftPercent: initialLeft / overlaySize.width,
            topPercent: initialTop / overlaySize.height,
            widthPercent: initialWidth / overlaySize.width,
          };

          setEdits(prev => [...prev, newEdit]);
          setActiveEditId(id);
          notify('success', 'Gambar Disisipkan', 'Posisikan gambar di dokumen.');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Smooth dragging events (Direct DOM manipulation for 60 FPS)
  const handleDragStart = (e, editId) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveEditId(editId);
    isInteractingRef.current = true;

    const element = document.getElementById(`el_${editId}`);
    if (!element || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const offsetX = clientX - elementRect.left;
    const offsetY = clientY - elementRect.top;

    const handleDragMove = (moveEvent) => {
      const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let newLeft = curX - containerRect.left - offsetX;
      let newTop = curY - containerRect.top - offsetY;

      // Bound restricts inside container
      const currentWidth = elementRect.width;
      const currentHeight = elementRect.height;
      const maxLeft = containerRect.width - currentWidth;
      const maxTop = containerRect.height - currentHeight;

      newLeft = Math.max(0, Math.min(maxLeft, newLeft));
      newTop = Math.max(0, Math.min(maxTop, newTop));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;

      // Update refs
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

      setEdits((prev) =>
        prev.map((item) =>
          item.id === editId ? { ...item, left: finalLeft, top: finalTop } : item
        )
      );

      // Save percentage positions
      if (overlaySize.width > 0 && overlaySize.height > 0) {
        pctEditsRef.current[editId] = {
          ...pctEditsRef.current[editId],
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

  // Smooth resize events (Direct DOM manipulation)
  const handleResizeStart = (e, editId) => {
    e.stopPropagation();
    isInteractingRef.current = true;

    const element = document.getElementById(`el_${editId}`);
    if (!element || !containerRef.current) return;

    const editItem = edits.find(item => item.id === editId);
    if (!editItem) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const initialWidth = element.clientWidth;
    const aspect = editItem.aspect || 1;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const startX = clientX;

    const handleResizeMove = (moveEvent) => {
      const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = curX - startX;

      let newWidth = initialWidth + deltaX;

      // Constrain inside container width
      const currentLeft = parseFloat(element.style.left || '0');
      const maxWidth = containerRect.width - currentLeft;

      newWidth = Math.max(30, Math.min(maxWidth, newWidth));
      const newHeight = Math.round(newWidth / aspect);

      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;

      element.dataset.width = newWidth;
    };

    const handleResizeEnd = () => {
      isInteractingRef.current = false;
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);

      const finalWidth = parseFloat(element.dataset.width ?? element.style.width);
      const finalHeight = Math.round(finalWidth / aspect);

      setEdits((prev) =>
        prev.map((item) =>
          item.id === editId
            ? { ...item, width: finalWidth, height: finalHeight }
            : item
        )
      );

      // Save percentage widths
      if (overlaySize.width > 0 && overlaySize.height > 0) {
        pctEditsRef.current[editId] = {
          ...pctEditsRef.current[editId],
          widthPercent: finalWidth / overlaySize.width,
        };
      }
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('touchend', handleResizeEnd);
  };

  // Modify active element properties
  const updateActiveText = (textVal) => {
    setEdits(prev =>
      prev.map(item => (item.id === activeEditId ? { ...item, text: textVal } : item))
    );
  };

  const updateActiveFontSize = (sizeVal) => {
    setEdits(prev =>
      prev.map(item => (item.id === activeEditId ? { ...item, fontSize: parseInt(sizeVal) } : item))
    );
  };

  const updateActiveColor = (colorVal) => {
    setEdits(prev =>
      prev.map(item => (item.id === activeEditId ? { ...item, color: colorVal } : item))
    );
  };

  // Delete active element
  const deleteActiveEdit = (editId) => {
    const idToDelete = editId || activeEditId;
    if (!idToDelete) return;

    setEdits(prev => prev.filter(item => item.id !== idToDelete));
    delete pctEditsRef.current[idToDelete];
    if (activeEditId === idToDelete) {
      setActiveEditId(null);
    }
    notify('success', 'Anotasi Dihapus', 'Elemen berhasil dibersihkan dari dokumen.');
  };

  // Clean workspace reset
  const resetAll = () => {
    setPdfFile(null);
    setPdfDoc(null);
    setEdits([]);
    pctEditsRef.current = {};
    setActiveEditId(null);
    setZoom(1.0);
    setPageNumber(1);
    setNumPages(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageUploadRef.current) imageUploadRef.current.value = '';
  };

  // Compile and Save PDF file
  const handleSave = async () => {
    if (!pdfFile) return;

    setLoader({ show: true, title: 'Menyimpan PDF', message: 'Membakar hasil edit ke dalam dokumen...', progress: 40 });

    try {
      // Scale visual coordinates to PDF points before burning
      const scaleX = pageDimensions.width / overlaySize.width;
      const scaleY = pageDimensions.height / overlaySize.height;

      const pdfEdits = edits.map((item) => {
        const embedX = item.left * scaleX;
        
        if (item.type === 'text') {
          // Adjust vertical offset for fonts (drawText draws from bottom baseline)
          const embedY = (overlaySize.height - item.top - (item.fontSize * 0.8)) * scaleY;
          return {
            pageIndex: item.pageIndex,
            type: 'text',
            text: item.text,
            x: embedX,
            y: embedY,
            fontSize: item.fontSize,
            color: item.color,
          };
        } else if (item.type === 'whiteout') {
          const embedY = (overlaySize.height - item.top - item.height) * scaleY;
          return {
            pageIndex: item.pageIndex,
            type: 'whiteout',
            x: embedX,
            y: embedY,
            width: item.width * scaleX,
            height: item.height * scaleY,
            color: item.color,
          };
        } else if (item.type === 'image') {
          const embedY = (overlaySize.height - item.top - item.height) * scaleY;
          return {
            pageIndex: item.pageIndex,
            type: 'image',
            file: item.file,
            x: embedX,
            y: embedY,
            width: item.width * scaleX,
            height: item.height * scaleY,
          };
        }
        return null;
      }).filter(Boolean);

      const resultBytes = await saveEditedPdf(pdfFile, pdfEdits);

      const originalShort = pdfFile.name.replace('.pdf', '');
      const downloadName = `${originalShort}_edited.pdf`;

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

      notify('success', 'Berhasil Disimpan', 'Dokumen PDF Anda telah diperbarui.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Menyimpan', err.message || 'Terjadi kesalahan saat mengekspor dokumen.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const activeEdit = edits.find(item => item.id === activeEditId);

  return (
    <section id="panel-edit" className="tab-panel space-y-4">
      {/* Navigation and Breadcrumbs */}
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
          <span className="text-indigo-400 text-xs font-bold font-mono uppercase tracking-wider">Edit PDF</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload PDF */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-indigo-400 tracking-widest uppercase">Pilih Berkas PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Silakan unggah dokumen PDF yang ingin Anda edit (tambah teks, gambar, sensor) secara offline.
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
                  ? 'border-indigo-500 bg-indigo-600/10'
                  : 'border-white/10 bg-black/20 hover:border-indigo-500 hover:bg-indigo-600/10'
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
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    Klik untuk pilih berkas PDF
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Workspace Editor */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar Controls (Left) */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 sm:space-y-6">
            
            {/* File Info */}
            <div className="space-y-1 pb-4 border-b border-white/5">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Dokumen PDF</span>
              <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>{pdfFile.name}</h4>
              <p className="text-xs text-indigo-400 font-mono">{formatBytes(pdfFile.size)} &bull; {numPages} Hal</p>
            </div>

            {/* Editing Tools Bar */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Toolbar Editor</span>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={addTextEdit}
                  className="flex flex-col items-center justify-center p-2.5 bg-black/25 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-600/5 rounded-xl transition-all cursor-pointer group text-center"
                  title="Tambah Teks"
                >
                  <svg className="h-5 w-5 text-white/60 group-hover:text-indigo-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[10px] font-semibold text-white/70">Teks</span>
                </button>

                <button
                  onClick={triggerImageUpload}
                  className="flex flex-col items-center justify-center p-2.5 bg-black/25 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-600/5 rounded-xl transition-all cursor-pointer group text-center"
                  title="Tambah Gambar"
                >
                  <input
                    type="file"
                    ref={imageUploadRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <svg className="h-5 w-5 text-white/60 group-hover:text-indigo-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1" />
                  </svg>
                  <span className="text-[10px] font-semibold text-white/70">Gambar</span>
                </button>

                <button
                  onClick={addWhiteoutEdit}
                  className="flex flex-col items-center justify-center p-2.5 bg-black/25 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-600/5 rounded-xl transition-all cursor-pointer group text-center"
                  title="Tambah Kotak Sensor"
                >
                  <svg className="h-5 w-5 text-white/60 group-hover:text-indigo-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <span className="text-[10px] font-semibold text-white/70">Sensor</span>
                </button>
              </div>
            </div>

            {/* Customization Details Pane */}
            {activeEdit && (
              <div className="space-y-4 pt-4 border-t border-white/5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Atur Elemen</span>
                  <button
                    onClick={() => deleteActiveEdit()}
                    className="text-[10px] text-red-400 font-bold hover:underline"
                  >
                    Hapus Elemen
                  </button>
                </div>

                {/* TEXT SETTINGS */}
                {activeEdit.type === 'text' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-white/60">Teks Isi</label>
                      <textarea
                        value={activeEdit.text}
                        onChange={(e) => updateActiveText(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none h-16 resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-semibold text-white/60">Ukuran Font</label>
                        <span className="text-[10px] font-bold text-indigo-400">{activeEdit.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="72"
                        value={activeEdit.fontSize}
                        onChange={(e) => updateActiveFontSize(e.target.value)}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-semibold text-white/60 font-mono">Warna Font</label>
                      <div className="flex items-center space-x-2">
                        {['#000000', '#ffffff', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b'].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateActiveColor(c)}
                            style={{ backgroundColor: c }}
                            className={`h-5 w-5 rounded-full border transition-all ${
                              activeEdit.color === c ? 'border-indigo-400 scale-110 shadow-md shadow-indigo-900/40' : 'border-white/10 hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* WHITEOUT SETTINGS */}
                {activeEdit.type === 'whiteout' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-semibold text-white/60">Warna Kotak Sensor</label>
                      <div className="flex items-center space-x-2">
                        {['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b'].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateActiveColor(c)}
                            style={{ backgroundColor: c }}
                            className={`h-5 w-5 rounded-full border transition-all ${
                              activeEdit.color === c ? 'border-indigo-400 scale-110 shadow-md shadow-indigo-900/40' : 'border-white/10 hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Page Navigator */}
            {numPages > 1 && (
              <div className="space-y-2 pt-4 border-t border-white/5">
                <label className="block text-[10px] font-bold font-mono tracking-widest text-white/40 uppercase">Pilih Halaman</label>
                <div className="flex items-center justify-between bg-black/25 rounded-xl px-2 py-1.5 border border-white/10">
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

            {/* Action buttons */}
            <div className="pt-4 border-t border-white/5 space-y-2">
              <button
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-indigo-900/40"
              >
                <span>Simpan &amp; Unduh PDF</span>
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
          <div 
            onClick={() => setActiveEditId(null)}
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

                {/* Draggable/Resizable overlays */}
                {edits
                  .filter(edit => edit.pageIndex === pageNumber - 1)
                  .map((edit) => {
                    const isActive = edit.id === activeEditId;
                    
                    return (
                      <div
                        key={edit.id}
                        id={`el_${edit.id}`}
                        onMouseDown={(e) => handleDragStart(e, edit.id)}
                        onTouchStart={(e) => handleDragStart(e, edit.id)}
                        style={{
                          position: 'absolute',
                          left: `${edit.left}px`,
                          top: `${edit.top}px`,
                          width: edit.type === 'text' ? 'auto' : `${edit.width}px`,
                          height: edit.type === 'text' ? 'auto' : `${edit.height}px`,
                          cursor: 'move',
                          border: isActive ? '2px dashed #6366f1' : '2px dashed transparent',
                          backgroundColor: isActive ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          userSelect: 'none',
                          touchAction: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: edit.type === 'text' ? '4px 8px' : '0px',
                          borderRadius: '4px',
                          zIndex: isActive ? 40 : 20,
                        }}
                      >
                        {/* 1. TEXT TYPE */}
                        {edit.type === 'text' && (
                          <span
                            style={{
                              fontSize: `${edit.fontSize * zoom}px`,
                              color: edit.color,
                              fontWeight: 'bold',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'Helvetica, Arial, sans-serif',
                            }}
                          >
                            {edit.text}
                          </span>
                        )}

                        {/* 2. WHITEOUT TYPE */}
                        {edit.type === 'whiteout' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: edit.color,
                              border: '1px solid rgba(255,255,255,0.2)',
                            }}
                          />
                        )}

                        {/* 3. IMAGE TYPE */}
                        {edit.type === 'image' && (
                          <img
                            src={edit.url}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              pointerEvents: 'none',
                            }}
                          />
                        )}

                        {/* Resize handle (Only for non-text items when active) */}
                        {isActive && edit.type !== 'text' && (
                          <div
                            onMouseDown={(e) => handleResizeStart(e, edit.id)}
                            onTouchStart={(e) => handleResizeStart(e, edit.id)}
                            style={{
                              position: 'absolute',
                              right: '-6px',
                              bottom: '-6px',
                              width: '12px',
                              height: '12px',
                              backgroundColor: '#6366f1',
                              border: '2px solid #ffffff',
                              borderRadius: '50%',
                              cursor: 'se-resize',
                              zIndex: 50,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            }}
                          />
                        )}

                        {/* Delete button cue (when active) */}
                        {isActive && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteActiveEdit(edit.id); }}
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

              {edits.filter(edit => edit.pageIndex === pageNumber - 1).length === 0 && (
                <div className="text-center p-6 space-y-2 text-white/40 pointer-events-none select-none">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <p className="text-xs font-semibold font-mono">Dokumen Terbuka</p>
                  <p className="text-[10px] leading-relaxed max-w-xs">
                    Gunakan Toolbar Editor di kolom kiri untuk menambahkan teks, gambar, atau sensor kotak putih di atas halaman dokumen.
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
