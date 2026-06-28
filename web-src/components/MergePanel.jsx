import React, { useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { mergePdfFiles } from '../js/pdfEngine.js';

export default function MergePanel({ notify, setLoader, downloadBlob, formatBytes, generateId }) {
  const [mergeFiles, setMergeFiles] = useState([]);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await registerMergeFiles(e.dataTransfer.files);
    }
  };

  const handleClickDropzone = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await registerMergeFiles(e.target.files);
    }
  };

  const registerMergeFiles = async (files) => {
    const validPdfs = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (validPdfs.length === 0) {
      notify('error', 'Format Salah', 'Hanya mendukung dokumen format PDF.');
      return;
    }

    setLoader({ show: true, title: 'Menganalisis Dokumen', message: 'Membuka metadata detail halaman PDF...', progress: 30 });

    let loadedCounter = 0;
    const newFiles = [];

    for (const file of validPdfs) {
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(buffer);
        const pages = pdf.getPageCount();

        newFiles.push({
          id: generateId(),
          file: file,
          filename: file.name,
          sizeStr: formatBytes(file.size),
          pageCount: pages,
        });
        loadedCounter++;
      } catch (err) {
        console.error(err);
        notify('error', 'Gagal Membuka File', `File "${file.name}" diproteksi kata sandi atau korup.`);
      }
    }

    setLoader({ show: false, title: '', message: '', progress: 0 });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // refresh input slot
    }

    if (loadedCounter > 0) {
      setMergeFiles((prev) => [...prev, ...newFiles]);
      notify('success', 'File Ditambahkan', `${loadedCounter} Dokumen PDF berhasil masuk antrean.`);
    }
  };

  const clearAll = () => {
    setMergeFiles([]);
    notify('success', 'Daftar Kosong', 'Kumpulan antrean file berhasil dibersihkan.');
  };

  const moveFile = (id, direction) => {
    setMergeFiles((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  const deleteFile = (id) => {
    setMergeFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const runMerge = async () => {
    if (mergeFiles.length < 2) {
      notify('error', 'Peringatan', 'Silakan pilih minimal 2 file PDF untuk dapat digabungkan.');
      return;
    }

    setLoader({ show: true, title: 'Menggabungkan PDF', message: 'Sedang memuat data binary dokumen...', progress: 10 });

    try {
      const sortedFilesOnly = mergeFiles.map((item) => item.file);
      const mergedBytes = await mergePdfFiles(sortedFilesOnly, (currentIndex, totalIndex) => {
        const percent = (currentIndex / totalIndex) * 100;
        setLoader({
          show: true,
          title: 'Menggabungkan PDF',
          message: `Dokumen ${currentIndex} dari ${totalIndex} selesai digabung.`,
          progress: percent,
        });
      });

      downloadBlob(mergedBytes, 'gabungan_pdffda.pdf');
      notify('success', 'Aksi Berhasil', 'PDF berhasil digabungkan dan siap diunduh.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagalan Kompilasi', 'Terjadi kesalahan sistem ketika menyusun lembar PDF Anda.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const totalCumulativePages = mergeFiles.reduce((acc, item) => acc + item.pageCount, 0);

  return (
    <section id="panel-merge" className="tab-panel space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Upload Area & Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 relative overflow-hidden">
            <h3 className="text-xs font-bold font-mono text-blue-400 tracking-widest uppercase">Ambil File PDF</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Pilih beberapa file PDF untuk digabungkan menjadi satu dokumen beruntun sesuai urutan yang Anda tentukan.
            </p>

            {/* Drag and Drop Zone */}
            <div
              id="dropzone-merge"
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
                multiple
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <div className="space-y-2">
                <div className="mx-auto h-10 w-10 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                  Klik untuk unggah
                </div>
                <div className="text-[10px] text-white/40">atau Drag &amp; Drop file di sini</div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 flex items-start space-x-3">
              <svg className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11.5px] text-white/70 leading-relaxed font-semibold">
                Gunakan tombol <span className="text-blue-400">Naik</span> / <span className="text-blue-400">Turun</span> di sebelah kanan daftar untuk menyusun kembali urutan penggabungan file PDF secara langsung.
              </p>
            </div>
          </div>
        </div>

        {/* List and Reordering Workspace */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[320px]">
            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex justify-between items-center shrink-0">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Daftar Urutan PDF</h3>
              {mergeFiles.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors cursor-pointer border border-red-500/20"
                >
                  Kosongkan Semua
                </button>
              )}
            </div>

            {/* Empty State */}
            {mergeFiles.length === 0 ? (
              <div id="empty-merge" className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="p-4 bg-white/5 rounded-full text-white/40 border border-white/10">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white/80">Belum Ada File Terpilih</h4>
                  <p className="text-[11px] text-white/45 mt-1 max-w-xs">
                    Silakan pilih atau seret dokumen PDF Anda terlebih dahulu di area pengunggahan sebelah kiri.
                  </p>
                </div>
              </div>
            ) : (
              /* Active File List Rows */
              <div id="list-merge" className="divide-y divide-white/5 overflow-y-auto flex-1 max-h-[400px]">
                {mergeFiles.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 hover:bg-white/5 border-b border-white/5 transition-all font-sans"
                  >
                    <div className="flex items-center space-x-3 truncate max-w-[65%]">
                      <div className="shrink-0 h-8 w-8 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center font-bold text-xs uppercase font-mono border border-blue-500/20 shadow-xs">
                        PDF
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-semibold text-white/95 truncate" title={item.filename}>
                          {item.filename}
                        </h4>
                        <p className="text-[10px] text-white/40 font-mono font-medium">
                          {item.sizeStr} &bull;{' '}
                          <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {item.pageCount} Hal
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Reorder Actions btn */}
                      <div className="inline-flex rounded-lg border border-white/10 bg-black/40 overflow-hidden shadow-sm">
                        <button
                          onClick={() => moveFile(item.id, -1)}
                          disabled={index === 0}
                          className="p-1 text-white/60 hover:text-blue-400 hover:bg-white/5 cursor-pointer focus:outline-hidden disabled:opacity-20"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveFile(item.id, 1)}
                          disabled={index === mergeFiles.length - 1}
                          className="p-1 text-white/60 hover:text-blue-400 hover:bg-white/5 cursor-pointer focus:outline-hidden border-l border-white/5 disabled:opacity-20"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Delete item btn */}
                      <button
                        onClick={() => deleteFile(item.id)}
                        className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors focus:outline-hidden border border-transparent hover:border-red-500/10"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Footing */}
            {mergeFiles.length > 0 && (
              <div className="bg-black/30 p-4 border-t border-white/10 flex justify-between items-center gap-4 shrink-0">
                <div className="text-xs font-mono text-white/40">
                  <span className="font-bold text-blue-400 text-sm">{mergeFiles.length}</span> File &bull;{' '}
                  <span className="font-bold text-blue-400 text-sm">{totalCumulativePages}</span> Halaman
                </div>
                <button
                  onClick={runMerge}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg inline-flex items-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-blue-900/40"
                >
                  <span>Gabungkan Dokumen</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
