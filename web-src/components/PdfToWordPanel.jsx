import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { convertPdfToWord } from '../js/pdfEngine.js';

export default function PdfToWordPanel({ notify, setLoader, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [fileInfo, setFileInfo] = useState({
    filename: '',
    sizeStr: '',
    pageCount: 0,
  });
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
      await loadPdfFile(e.dataTransfer.files[0]);
    }
  };

  const handleClickDropzone = () => {
    if (pdfFile) return;
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await loadPdfFile(e.target.files[0]);
    }
  };

  const loadPdfFile = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Hanya mendukung berkas dokumen PDF.');
      return;
    }

    setLoader({ show: true, title: 'Menganalisis PDF', message: 'Membuka dokumen berkas...', progress: 10 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setPdfFile(file);
      setFileInfo({
        filename: file.name,
        sizeStr: formatBytes(file.size),
        pageCount: pdf.numPages,
      });

      notify('success', 'PDF Dimuat', 'Dokumen siap untuk dikonversikan ke Word.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Membuka berkas', 'Berkas PDF terenkripsi kata sandi atau korup.');
      resetPanel();
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const resetPanel = () => {
    setPdfFile(null);
    setFileInfo({
      filename: '',
      sizeStr: '',
      pageCount: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadWord = async () => {
    if (!pdfFile) return;

    setLoader({ show: true, title: 'Mengonversi PDF', message: 'Mengekstrak teks halaman 1...', progress: 5 });

    try {
      const wordBytes = await convertPdfToWord(pdfFile, (currPage, totalPages) => {
        const percent = (currPage / totalPages) * 100;
        setLoader({
          show: true,
          title: 'Mengonversi PDF',
          message: `Mengekstrak halaman ${currPage} dari ${totalPages}...`,
          progress: percent,
        });
      });

      // Download Word file
      const originalShortName = pdfFile.name.replace('.pdf', '');
      const filenameResult = `${originalShortName}_converted.doc`;

      const blob = new Blob([wordBytes], { type: 'application/msword' });
      const downloadUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = downloadUrl;
      tempLink.download = filenameResult;
      document.body.appendChild(tempLink);
      tempLink.click();

      setTimeout(() => {
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(downloadUrl);
      }, 300);

      notify('success', 'Konversi Selesai', 'Berkas Word (.doc) berhasil diunduh.');
    } catch (err) {
      console.error(err);
      notify('error', 'Konversi Gagal', 'Terjadi kesalahan mengekstrak teks dari PDF.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  return (
    <section id="panel-pdf-to-word" className="tab-panel space-y-6">
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
        <span className="text-cyan-400 text-xs font-bold font-mono uppercase tracking-wider">PDF ke Word</span>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-sm font-bold font-mono text-cyan-400 tracking-widest uppercase">Konversi PDF ke Word</h3>
            <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
              Ubah dokumen PDF Anda menjadi berkas Microsoft Word (.doc) yang dapat diedit secara instan, 100% lokal di browser Anda.
            </p>
          </div>

          {/* Upload and Drag Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleClickDropzone}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
              isDragActive
                ? 'border-cyan-500 bg-cyan-600/10'
                : 'border-white/10 bg-black/20 hover:border-cyan-500 hover:bg-cyan-600/10'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="application/pdf"
              onChange={handleFileChange}
            />

            {!pdfFile ? (
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                    Klik untuk pilih berkas PDF
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">atau seret dan lepas file PDF di sini</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="mx-auto h-16 w-16 text-cyan-450 flex items-center justify-center bg-cyan-500/10 rounded-full border border-cyan-500/30">
                  <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white truncate max-w-md mx-auto" title={fileInfo.filename}>
                    {fileInfo.filename}
                  </div>
                  <div className="text-xs text-white/40 font-mono font-medium">
                    {fileInfo.sizeStr} &bull; <span className="text-cyan-400">{fileInfo.pageCount} Halaman</span>
                  </div>
                </div>
                
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current.click();
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Ganti File
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetPanel();
                    }}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>

          {pdfFile && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={handleDownloadWord}
                className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-6 py-3 rounded-xl inline-flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-cyan-900/40"
              >
                <span>Konversikan ke Word</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
