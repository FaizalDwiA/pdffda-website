import React, { useRef, useState } from 'react';
import { getPdfThumbnails, processPagesSelection } from '../js/pdfEngine.js';

export default function SplitPanel({ notify, setLoader, downloadBlob, formatBytes, onBack }) {
  const [splitFile, setSplitFile] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const fileInputRef = useRef(null);
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
      await loadSplitFile(e.dataTransfer.files[0]);
    }
  };

  const handleClickDropzone = () => {
    if (splitFile) return; // if active, click change file instead
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await loadSplitFile(e.target.files[0]);
    }
  };

  const loadSplitFile = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Hanya mendukung berkas dokumen PDF.');
      return;
    }

    setSplitFile(file);
    setLoader({ show: true, title: 'Rendisi Halaman', message: 'Membuat thumbnail visual lembaran PDF...', progress: 1 });

    try {
      const results = await getPdfThumbnails(file, (currPage, totalPages) => {
        const percentage = (currPage / totalPages) * 100;
        setLoader({
          show: true,
          title: 'Rendisi Halaman',
          message: `Melukis halaman ${currPage} dari ${totalPages}...`,
          progress: percentage,
        });
      });

      setThumbnails(
        results.thumbnails.map((t) => ({
          ...t,
          selected: false,
        }))
      );

      notify('success', 'PDF Dimuat', 'Pratinjau halaman berhasil dirender dengan aman.');
    } catch (err) {
      console.error(err);
      notify('error', 'Rendering Gagal', 'Sandi pengaman aktif, silakan decrypt file PDF terlebih dahulu.');
      
      // Reset state
      setSplitFile(null);
      setThumbnails([]);
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const handleChangeFileClick = (e) => {
    e.stopPropagation();
    fileInputRef.current.click();
  };

  const toggleAll = (flag) => {
    setThumbnails((prev) => prev.map((t) => ({ ...t, selected: flag })));
  };

  const invertAll = () => {
    setThumbnails((prev) => prev.map((t) => ({ ...t, selected: !t.selected })));
  };

  const toggleThumbnail = (idx) => {
    setThumbnails((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], selected: !updated[idx].selected };
      return updated;
    });
  };

  const processSplitExecution = async (isDeleteMode) => {
    if (!splitFile) {
      notify('error', 'Kekosongan data', 'Silakan pilih dokumen PDF terlebih dahulu.');
      return;
    }

    const selectedPages = thumbnails.filter((t) => t.selected).map((t) => t.pageNumber);

    if (selectedPages.length === 0) {
      notify('error', 'Seleksi Kosong', 'Harap klik setidaknya 1 lembar halaman pratinjau untuk memulai.');
      return;
    }

    const actWord = isDeleteMode ? 'Menghapus' : 'Mengekstrak';
    setLoader({ show: true, title: `${actWord} Halaman`, message: 'Menyusun segmentasi halaman biner...', progress: 20 });

    try {
      const parsedBytes = await processPagesSelection(splitFile, selectedPages, isDeleteMode);
      
      const operationSlug = isDeleteMode ? 'terpotong' : 'ekstrak';
      const originalShortName = splitFile.name.replace('.pdf', '');
      const filenameResult = `${originalShortName}_${operationSlug}.pdf`;
      
      downloadBlob(parsedBytes, filenameResult);
      notify('success', 'Tindakan Selesai', `Lembaran PDF Anda berhasil dibuat.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Operasi', err.message || 'Terjadi kesalahan internal pemotongan halaman.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const selectedCount = thumbnails.filter((t) => t.selected).length;
  const totalCount = thumbnails.length;

  return (
    <section id="panel-split" className="tab-panel space-y-6">
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
        <span className="text-blue-400 text-xs font-bold font-mono uppercase tracking-wider">Pisah &amp; Hapus Halaman</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Source Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold font-mono text-blue-400 tracking-widest uppercase font-semibold">Input File PDF</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Pilih berkas PDF orisinal untuk melihat layout per halaman secara visual.
            </p>

            {/* Single Upload Box */}
            <div
              id="dropzone-split"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={handleClickDropzone}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive
                  ? 'border-blue-500 bg-blue-600/10'
                  : 'border-white/10 bg-black/20 hover:border-blue-500 hover:bg-blue-600/10'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/pdf"
                onChange={handleFileChange}
              />
              
              {!splitFile ? (
                <div className="space-y-2" id="split-uploader-prompt">
                  <div className="mx-auto h-10 w-10 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                    Klik untuk pilih
                  </div>
                  <div className="text-[10px] text-white/40">atau seret file ke sini</div>
                </div>
              ) : (
                <div id="split-uploader-active" className="space-y-2 py-2">
                  <div className="mx-auto h-12 w-12 text-blue-400 flex items-center justify-center bg-blue-500/10 rounded-full border border-blue-500/30">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-xs font-bold text-white truncate px-1" title={splitFile.name}>
                    {splitFile.name}
                  </div>
                  <div className="text-[9px] text-white/40 font-mono">
                    {formatBytes(splitFile.size)}
                  </div>
                  <button
                    id="btn-change-split"
                    onClick={handleChangeFileClick}
                    className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline font-bold block mx-auto pt-1 cursor-pointer"
                  >
                    Ganti File
                  </button>
                </div>
              )}
            </div>

            {/* Utilities Mode Actions (Active Only) */}
            {splitFile && (
              <div id="split-actions" className="space-y-4">
                <div className="border-t border-white/10 pt-4 space-y-2">
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">
                    Pilihan Cepat Halaman
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => toggleAll(true)}
                      className="bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-medium py-1.5 px-2 rounded-md border border-white/5 transition-colors text-center cursor-pointer"
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => toggleAll(false)}
                      className="bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-medium py-1.5 px-2 rounded-md border border-white/5 transition-colors text-center cursor-pointer"
                    >
                      Kosong
                    </button>
                    <button
                      onClick={invertAll}
                      className="bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-medium py-1.5 px-2 rounded-md border border-white/5 transition-colors text-center cursor-pointer"
                    >
                      Balik
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 bg-black/20 border border-white/10 p-3 rounded-lg block">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white/50">Halaman Terpilih:</span>
                    <span id="selected-badge" className="font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                      {selectedCount} dari {totalCount}
                    </span>
                  </div>
                </div>

                {/* Two Primary Methods to Output */}
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <button
                    onClick={() => processSplitExecution(false)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-900/20 transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Ekstrak Terpilih</span>
                  </button>
                  <button
                    onClick={() => processSplitExecution(true)}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Hapus Terpilih</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Previews Workspace */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[380px]">
            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Lembar Preview &amp; Seleksi Halaman</h3>
            </div>

            {/* Empty State */}
            {!splitFile ? (
              <div id="empty-split" className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="p-4 bg-white/5 rounded-full text-white/40 border border-white/10">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white/80">Preview PDF Kosong</h4>
                  <p className="text-[11px] text-white/45 mt-1 max-w-sm">
                    Daftar halaman akan langsung dimuat secara visual dengan rendering canvas yang aman di sini setelah Anda mengunggah berkas.
                  </p>
                </div>
              </div>
            ) : (
              /* Grid previews wrapper */
              <div id="split-grid" className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[600px]">
                {thumbnails.map((thumb, idx) => {
                  const selectedClass = thumb.selected
                    ? 'border-2 border-blue-500 bg-white/10 shadow-2xl ring-2 ring-blue-500/20'
                    : 'border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10';

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleThumbnail(idx)}
                      className={`rounded-xl p-2 cursor-pointer transition-all duration-150 flex flex-col space-y-2 select-none relative group ${selectedClass}`}
                    >
                      {/* Thumbnail box content */}
                      <div className="bg-[#0c111d]/50 rounded-lg overflow-hidden flex items-center justify-center relative aspect-[3/4] border border-white/5 shadow-md">
                        <img
                          src={thumb.dataUrl}
                          alt={`Hal ${thumb.pageNumber}`}
                          className="w-full h-full object-contain"
                          draggable="false"
                        />
                        
                        {/* Hover background filter */}
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        {/* Selection Check bubble visual overlay */}
                        <div className={`checkbox-visual absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center border transition-all ${
                          thumb.selected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-black/40 border-white/30 text-transparent'
                        }`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Footer tag detail */}
                      <div className={`text-center font-mono text-[10px] py-0.5 font-bold ${
                        thumb.selected ? 'text-blue-400' : 'text-white/50'
                      }`}>
                        Hal {thumb.pageNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
