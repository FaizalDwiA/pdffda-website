import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { encryptPdf } from '../js/pdfEngine.js';

const PDFJS_VERSION = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export default function EncryptPdfPanel({ notify, setLoader, downloadBlob, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useCustomOwnerPassword, setUseCustomOwnerPassword] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowModifying, setAllowModifying] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const loadPdfFile = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('error', 'Format Salah', 'Harap masukkan berkas PDF.');
      return;
    }

    setLoader({ show: true, title: 'Membaca PDF', message: 'Memuat halaman...', progress: 20 });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      setPdfFile(file);
      setNumPages(doc.numPages);
      setPassword('');
      setConfirmPassword('');
      notify('success', 'PDF Dimuat', `${doc.numPages} halaman siap diproteksi kata sandi.`);
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
    setPassword('');
    setConfirmPassword('');
    setUseCustomOwnerPassword(false);
    setOwnerPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRunEncrypt = async () => {
    if (!pdfFile) return;

    if (!password) {
      notify('error', 'Kata Sandi Kosong', 'Harap masukkan kata sandi untuk mengunci PDF.');
      return;
    }

    if (password !== confirmPassword) {
      notify('error', 'Sandi Tidak Cocok', 'Kata sandi dan konfirmasi kata sandi tidak sama.');
      return;
    }

    if (useCustomOwnerPassword && !ownerPassword) {
      notify('error', 'Kata Sandi Pemilik Kosong', 'Harap isi Kata Sandi Pemilik atau matikan opsi kustom.');
      return;
    }

    setLoader({ show: true, title: 'Mengenkripsi PDF', message: 'Menerapkan proteksi kata sandi...', progress: 20 });
    try {
      const encryptedBytes = await encryptPdf(
        pdfFile,
        {
          password,
          ownerPassword: useCustomOwnerPassword ? ownerPassword : null,
          preventCopy: !allowCopying,
          allowModifying,
          allowPrinting,
        },
        (curr, total) => {
          const percent = Math.round(20 + (curr / total) * 70);
          setLoader({
            show: true,
            title: 'Memproses Proteksi Anti-Copy',
            message: `Meratakan teks halaman ${curr} dari ${total}...`,
            progress: percent,
          });
        }
      );

      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const outName = `${baseName}_protected.pdf`;

      downloadBlob(encryptedBytes, outName);
      notify('success', 'PDF Terkunci', `Berkas PDF berhasil diproteksi kata sandi.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Enkripsi', err.message || 'Terjadi kesalahan saat mengunci PDF.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  // Password strength logic
  const getPasswordStrength = () => {
    if (!password) return { label: 'Kosong', color: 'text-white/30', bg: 'bg-white/10', percent: 0 };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { label: 'Lemah', color: 'text-red-400', bg: 'bg-red-500', percent: 33 };
    if (score <= 4) return { label: 'Sedang', color: 'text-yellow-400', bg: 'bg-yellow-500', percent: 66 };
    return { label: 'Kuat', color: 'text-emerald-400', bg: 'bg-emerald-500', percent: 100 };
  };

  const strength = getPasswordStrength();

  return (
    <section id="panel-encrypt-pdf" className="tab-panel space-y-4">
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
          <span className="text-rose-400 text-xs font-bold font-mono uppercase tracking-wider">Kunci PDF</span>
        </div>
      </div>

      {!pdfFile ? (
        /* STEP 1: Upload Dropzone */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-rose-400 tracking-widest uppercase">Proteksi Dokumen PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Berikan kata sandi pada dokumen PDF Anda secara 100% offline langsung di peramban tanpa mengunggah ke server.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive ? 'border-rose-500 bg-rose-600/10' : 'border-white/10 bg-black/20 hover:border-rose-500 hover:bg-rose-600/10'
              }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-rose-400">Klik untuk memilih berkas PDF</div>
                <div className="text-[10px] text-white/40">Mendukung berkas PDF apa pun</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Password Setup Form */
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-6">

            {/* File Info */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate" title={pdfFile.name}>
                  {pdfFile.name}
                </h4>
                <div className="text-xs text-white/50 font-mono">
                  {formatBytes(pdfFile.size)} &bull; {numPages} Halaman
                </div>
              </div>
              <button
                onClick={resetAll}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Ganti File
              </button>
            </div>

            {/* Password Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-white/80">Kata Sandi Baru</label>
                  {password && <span className={`text-[10px] font-bold ${strength.color}`}>{strength.label}</span>}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi PDF..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:border-rose-500 focus:outline-none pr-10"
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

                {/* Strength Bar */}
                {password && (
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                    <div className={`h-full ${strength.bg} transition-all duration-300`} style={{ width: `${strength.percent}%` }}></div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80">Konfirmasi Kata Sandi</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi..."
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none ${
                    confirmPassword && password !== confirmPassword ? 'border-red-500' : 'border-white/10 focus:border-rose-500'
                  }`}
                />
                {confirmPassword && password !== confirmPassword && (
                  <div className="text-[10px] text-red-400 font-semibold">Kata sandi tidak cocok.</div>
                )}
              </div>

              {/* Custom Owner Password Toggle */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomOwnerPassword}
                    onChange={(e) => setUseCustomOwnerPassword(e.target.checked)}
                    className="rounded bg-black/40 border-white/20 text-rose-500 focus:ring-0 accent-rose-500"
                  />
                  <span className="text-xs font-semibold text-white/80">
                    Atur Kata Sandi Pemilik (Owner Password) Kustom
                  </span>
                </label>

                {useCustomOwnerPassword ? (
                  <div className="space-y-1.5 pt-1 pl-6">
                    <label className="block text-xs font-bold text-rose-300">
                      Kata Sandi Pemilik (Owner/Master Password)
                    </label>
                    <div className="relative">
                      <input
                        type={showOwnerPassword ? 'text' : 'password'}
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Kata sandi khusus pemilik/admin..."
                        className="w-full bg-black/40 border border-rose-500/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-rose-500 focus:outline-none pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                      >
                        {showOwnerPassword ? (
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
                      Diperlukan jika Anda ingin membuka batasan izin dokumen di masa depan.
                    </div>
                  </div>
                ) : (
                  <div className="pl-6 text-[10px] text-white/40 leading-tight">
                    &bull; Otomatis (Default): Sistem mengamankan kata sandi pemilik di latar belakang secara otomatis.
                  </div>
                )}
              </div>
            </div>

            {/* Permission Toggles */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <label className="block text-xs font-bold font-mono tracking-widest text-white/50 uppercase">
                Pengaturan Izin (Permissions)
              </label>

              <div className="space-y-2 text-xs">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPrinting}
                    onChange={(e) => setAllowPrinting(e.target.checked)}
                    className="rounded bg-black/40 border-white/20 text-rose-500 focus:ring-0 accent-rose-500"
                  />
                  <span className="text-white/80 font-medium">Izinkan Pencetakan (Printing)</span>
                </label>

                <div className="space-y-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-rose-500 focus:ring-0 accent-rose-500"
                    />
                    <span className="text-white/80 font-medium">Izinkan Menyalin Teks &amp; Konten</span>
                  </label>
                  {!allowCopying && (
                    <div className="pl-6 text-[10px] text-rose-400/90 leading-tight font-medium">
                      &bull; Proteksi Anti-Copy Aktif: Teks akan diratakan menjadi gambar jernih agar 100% tidak dapat disalin/di-copas di browser atau PDF viewer apa pun.
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowModifying}
                      onChange={(e) => setAllowModifying(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-rose-500 focus:ring-0 accent-rose-500"
                    />
                    <span className="text-white/80 font-medium">Izinkan Mengubah / Mengedit Berkas</span>
                  </label>
                  {!allowModifying && (
                    <div className="pl-6 text-[10px] text-rose-400/90 leading-tight font-medium">
                      &bull; Proteksi Anti-Edit Aktif: Membuat Kata Sandi Pemilik terpisah agar aplikasi pengedit PDF menolak pengeditan dokumen.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Encrypt Action Button */}
            <button
              onClick={handleRunEncrypt}
              disabled={!password || password !== confirmPassword}
              className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl inline-flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-rose-900/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Kunci &amp; Enkripsi PDF</span>
            </button>

          </div>
        </div>
      )}
    </section>
  );
}
