import React, { useRef, useState } from 'react';
import { getPdfMetadata, updatePdfMetadata } from '../js/pdfEngine.js';

export default function EditMetadataPanel({ notify, setLoader, downloadBlob, formatBytes, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [metadata, setMetadata] = useState({
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creationDate: '',
    modificationDate: '',
  });
  const [docInfo, setDocInfo] = useState({
    filename: '',
    sizeStr: '',
    pageCount: 0,
    creationDate: '',
    modificationDate: '',
  });

  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Helper to convert ISO Date String to local datetime-local value (YYYY-MM-DDTHH:mm)
  const convertToDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const offset = date.getTimezoneOffset() * 60000;
      const localISODate = new Date(date.getTime() - offset).toISOString();
      return localISODate.substring(0, 16);
    } catch {
      return '';
    }
  };

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

    setLoader({ show: true, title: 'Menganalisis PDF', message: 'Mengekstrak properti metadata berkas...', progress: 30 });

    try {
      const extracted = await getPdfMetadata(file);
      setPdfFile(file);
      setMetadata({
        title: extracted.title,
        author: extracted.author,
        subject: extracted.subject,
        keywords: extracted.keywords,
        creator: extracted.creator,
        producer: extracted.producer,
        creationDate: convertToDateTimeLocal(extracted.creationDate),
        modificationDate: convertToDateTimeLocal(extracted.modificationDate),
      });

      // Format Date for display
      const formatDate = (isoString) => {
        if (!isoString) return '-';
        try {
          const date = new Date(isoString);
          return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        } catch {
          return isoString;
        }
      };

      setDocInfo({
        filename: file.name,
        sizeStr: formatBytes(file.size),
        pageCount: extracted.pageCount,
        creationDate: formatDate(extracted.creationDate),
        modificationDate: formatDate(extracted.modificationDate),
      });

      notify('success', 'PDF Terbuka', 'Metadata dokumen berhasil dimuat.');
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
    setMetadata({
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
      creationDate: '',
      modificationDate: '',
    });
    setDocInfo({
      filename: '',
      sizeStr: '',
      pageCount: 0,
      creationDate: '',
      modificationDate: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    if (!pdfFile) return;

    setLoader({ show: true, title: 'Menyimpan Metadata', message: 'Menyusun berkas PDF biner baru...', progress: 40 });

    try {
      const updatedBytes = await updatePdfMetadata(pdfFile, metadata);
      
      const originalShortName = pdfFile.name.replace('.pdf', '');
      const filenameResult = `${originalShortName}_meta.pdf`;

      downloadBlob(updatedBytes, filenameResult);
      notify('success', 'Metadata Diperbarui', 'Berkas PDF baru dengan metadata telah diunduh.');
      
      // Reload updated file to refresh states
      const updatedFile = new File([updatedBytes], pdfFile.name, { type: 'application/pdf' });
      await loadPdfFile(updatedFile);
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem menyusun PDF.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  return (
    <section id="panel-metadata" className="tab-panel space-y-6">
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
        <span className="text-purple-400 text-xs font-bold font-mono uppercase tracking-wider">Edit Metadata PDF</span>
      </div>

      {!pdfFile ? (
        /* Upload View */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold font-mono text-purple-400 tracking-widest uppercase">Pilih Berkas PDF</h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                Silakan unggah berkas PDF Anda untuk membaca, memodifikasi, dan menyimpan metadata dokumen secara lokal di browser Anda.
              </p>
            </div>

            {/* Drag/Drop Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={handleClickDropzone}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                isDragActive
                  ? 'border-purple-500 bg-purple-600/10'
                  : 'border-white/10 bg-black/20 hover:border-purple-500 hover:bg-purple-600/10'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-purple-400 group-hover:text-purple-300 transition-colors">
                    Klik untuk pilih berkas PDF
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">atau seret dan lepas file PDF di sini</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Form & Detail Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form Edit */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-3">
                Formulir Properti Metadata
              </h3>
            </div>

            <form onSubmit={handleSaveMetadata} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Judul Dokumen (Title)</label>
                <input
                  type="text"
                  name="title"
                  value={metadata.title}
                  onChange={handleInputChange}
                  placeholder="Masukkan judul dokumen..."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium"
                />
              </div>

              {/* Author Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Penulis (Author)</label>
                <input
                  type="text"
                  name="author"
                  value={metadata.author}
                  onChange={handleInputChange}
                  placeholder="Nama pembuat/pemilik..."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium"
                />
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-white/70">Subjek (Subject)</label>
                <input
                  type="text"
                  name="subject"
                  value={metadata.subject}
                  onChange={handleInputChange}
                  placeholder="Topik atau deskripsi subjek dokumen..."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium"
                />
              </div>

              {/* Keywords Input */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-white/70">Kata Kunci (Keywords)</label>
                <input
                  type="text"
                  name="keywords"
                  value={metadata.keywords}
                  onChange={handleInputChange}
                  placeholder="Kata kunci dipisahkan dengan koma (contoh: laporan, keuangan, 2026)..."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium"
                />
              </div>

              {/* Creator Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Aplikasi Pembuat (Creator)</label>
                <input
                  type="text"
                  name="creator"
                  value={metadata.creator}
                  onChange={handleInputChange}
                  placeholder="Program yang memformulasikan PDF..."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium"
                />
              </div>

              {/* Producer Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Produser PDF (Producer)</label>
                <input
                  type="text"
                  name="producer"
                  value={metadata.producer}
                  onChange={handleInputChange}
                  placeholder="Pihak/Sistem produser berkas..."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium"
                />
              </div>

              {/* Creation Date Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Tanggal Pembuatan</label>
                <input
                  type="datetime-local"
                  name="creationDate"
                  value={metadata.creationDate}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium font-mono"
                />
              </div>

              {/* Modification Date Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Modifikasi Terakhir</label>
                <input
                  type="datetime-local"
                  name="modificationDate"
                  value={metadata.modificationDate}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 transition-all outline-hidden font-medium font-mono"
                />
              </div>

              {/* Action Save Button inside form */}
              <div className="sm:col-span-2 pt-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-3 rounded-xl inline-flex items-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-purple-900/40"
                >
                  <span>Simpan &amp; Unduh PDF</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>

            </form>
          </div>

          {/* Right Column: File Info Card */}
          <div className="space-y-4">
            
            {/* Document Info Card */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-purple-400 tracking-widest uppercase">
                Detail Dokumen Asli
              </h4>

              <div className="divide-y divide-white/5 text-[11px] font-sans">
                
                {/* Filename */}
                <div className="py-2.5 flex flex-col space-y-1">
                  <span className="text-white/40">Nama File</span>
                  <span className="text-white font-bold truncate" title={docInfo.filename}>
                    {docInfo.filename}
                  </span>
                </div>

                {/* Size & Page Count */}
                <div className="py-2.5 grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <span className="text-white/40">Ukuran Berkas</span>
                    <span className="text-white font-bold font-mono">{docInfo.sizeStr}</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-white/40">Total Halaman</span>
                    <span className="text-white font-bold font-mono">{docInfo.pageCount} Hal</span>
                  </div>
                </div>

                {/* Creation Date */}
                <div className="py-2.5 flex flex-col space-y-1">
                  <span className="text-white/40">Tanggal Pembuatan</span>
                  <span className="text-white font-medium font-mono">{docInfo.creationDate}</span>
                </div>

                {/* Modification Date */}
                <div className="py-2.5 flex flex-col space-y-1">
                  <span className="text-white/40">Modifikasi Terakhir</span>
                  <span className="text-white font-medium font-mono">{docInfo.modificationDate}</span>
                </div>

              </div>

              {/* Sidebar actions: change file / reset */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center"
                >
                  Ganti File
                </button>
                <button
                  onClick={resetPanel}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center"
                >
                  Tutup File
                </button>
              </div>

            </div>
          </div>

        </div>
      )}
    </section>
  );
}
