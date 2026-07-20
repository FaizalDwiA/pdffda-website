import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { decryptPdf } from '../js/pdfEngine.js';

const PDFJS_VERSION = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export default function DecryptPdfPanel({ notify, setLoader, downloadBlob, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const loadPdfFile = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Harap masukkan berkas PDF.');
      return;
    }

    setLoader({ show: true, title: 'Membaca PDF', message: 'Memeriksa proteksi dokumen...', progress: 20 });
    try {
      const arrayBuffer = await file.arrayBuffer();
      let encryptedDetected = false;
      let pagesCount = 0;

      try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        pagesCount = doc.numPages;
      } catch (err) {
        if (err.name === 'PasswordException') {
          encryptedDetected = true;
        } else {
          throw err;
        }
      }

      setPdfFile(file);
      setNumPages(pagesCount);
      setIsEncrypted(encryptedDetected);
      setPassword('');
      
      if (encryptedDetected) {
        notify('info', 'PDF Terkunci', 'Dokumen diproteksi kata sandi. Harap masukkan kata sandi untuk membuka kunci.');
      } else {
        notify('success', 'PDF Dimuat', 'Dokumen PDF siap diproses untuk dihilangkan kuncinya.');
      }
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
    setIsEncrypted(false);
    setPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRunDecrypt = async () => {
    if (!pdfFile) return;

    if (isEncrypted && !password) {
      notify('error', 'Kata Sandi Kosong', 'Harap masukkan kata sandi untuk membuka kunci PDF.');
      return;
    }

    setLoader({ show: true, title: 'Membuka Kunci PDF', message: 'Mendekripsi dokumen...', progress: 30 });
    try {
      const unlockedBytes = await decryptPdf(
        pdfFile,
        { password },
        (curr, total) => {
          const percent = Math.round(30 + (curr / total) * 60);
          setLoader({
            show: true,
            title: 'Memproses Halaman PDF',
            message: `Membuka halaman ${curr} dari ${total}...`,
            progress: percent,
          });
        }
      );

      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const outName = `${baseName}_unlocked.pdf`;

      downloadBlob(unlockedBytes, outName);
      notify('success', 'Kunci Terbuka', `Berkas PDF berhasil dihilangkan kata sandinya!`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Dekripsi', err.message || 'Terjadi kesalahan saat membuka kunci PDF.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  return (
    <section id="panel-decrypt-pdf" className="tab-panel space-y-4">
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
          <span className="text-amber-400 text-xs font-bold font-mono uppercase tracking-wider">Buka Kunci PDF</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload Dropzone */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-amber-400 tracking-widest uppercase">Buka Kunci / Password PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Hapus atau buka kata sandi dokumen PDF yang terkunci 100% secara aman tanpa mengunggah file ke server.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive ? 'border-amber-500 bg-amber-600/10' : 'border-white/10 bg-black/20 hover:border-amber-500 hover:bg-amber-600/10'
              }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-amber-400">Klik untuk memilih berkas PDF terkunci</div>
                <div className="text-[10px] text-white/40">Mendukung berkas PDF yang diproteksi kata sandi</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Decrypt Password Form */
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-6">

            {/* File Info */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>
                  {pdfFile.name}
                </h4>
                <div className="text-xs text-white/50 font-mono">
                  {formatBytes(pdfFile.size)} &bull; {isEncrypted ? 'Status: Terkunci (Encrypted)' : `${numPages} Halaman`}
                </div>
              </div>
              <button
                onClick={resetAll}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Ganti File
              </button>
            </div>

            {/* Password Input (If Encrypted) */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80">
                  Kata Sandi PDF {isEncrypted && <span className="text-amber-400">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi pembuka PDF..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:border-amber-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 0112.54 12.54m-12.54-12.54L3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="text-[10px] text-white/40 leading-tight">
                  Ketikkan kata sandi yang digunakan untuk mengunci dokumen ini.
                </div>
              </div>
            </div>

            {/* Decrypt Action Button */}
            <button
              onClick={handleRunDecrypt}
              disabled={isEncrypted && !password}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-amber-900/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              <span>Buka Kunci PDF (Hapus Password)</span>
            </button>

          </div>
        </div>
      )}
    </section>
  );
}
