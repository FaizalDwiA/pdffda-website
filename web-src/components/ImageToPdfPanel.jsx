import React, { useRef, useState } from 'react';
import { imagesToPdf } from '../js/pdfEngine.js';

export default function ImageToPdfPanel({ notify, setLoader, downloadBlob, generateId }) {
  const [imgFiles, setImgFiles] = useState([]);
  const [imgOptions, setImgOptions] = useState({
    pageSize: 'A4',
    orientation: 'portrait',
    margin: 'none',
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      registerImageFiles(e.dataTransfer.files);
    }
  };

  const handleClickDropzone = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      registerImageFiles(e.target.files);
    }
  };

  const registerImageFiles = (files) => {
    const validFormats = ['image/jpeg', 'image/jpg', 'image/png'];
    const loadedArr = Array.from(files).filter(
      (f) => validFormats.includes(f.type) || f.name.toLowerCase().match(/\.(jpg|jpeg|png)$/)
    );

    if (loadedArr.length === 0) {
      notify('error', 'Format gambar salah', 'Kolom ini eksklusif mendukung format gambar JPG, JPEG, atau PNG.');
      return;
    }

    const newFiles = loadedArr.map((file) => ({
      id: generateId(),
      file: file,
      filename: file.name,
      objectUrl: URL.createObjectURL(file), // temporary local display url
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // erase cache
    }

    setImgFiles((prev) => [...prev, ...newFiles]);
    notify('success', 'Gambar Masuk', `${loadedArr.length} Foto dimasukkan ke koleksi halaman.`);
  };

  const clearAll = () => {
    imgFiles.forEach((item) => URL.revokeObjectURL(item.objectUrl));
    setImgFiles([]);
    notify('success', 'Konversi Direset', 'Kliping kumpulan gambar berhasil dibersihkan.');
  };

  const swapImgItem = (id, direction) => {
    setImgFiles((prev) => {
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

  const deleteImgItem = (id) => {
    setImgFiles((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const runImageToPdf = async () => {
    if (imgFiles.length === 0) {
      notify('error', 'Berkas Kosong', 'Silakan pilih gambar terlebih dahulu sebelum mengonversi.');
      return;
    }

    setLoader({ show: true, title: 'Mengonversi Gambar', message: 'Menyesuaikan dimensi resolusi gambaran...', progress: 10 });

    try {
      const filesArr = imgFiles.map((i) => i.file);
      const compiledPdf = await imagesToPdf(filesArr, imgOptions, (curr, total) => {
        const percent = (curr / total) * 100;
        setLoader({
          show: true,
          title: 'Menyalin Halaman',
          message: `Melukis gambar ${curr} dari ${total} halaman ke berkas...`,
          progress: percent,
        });
      });

      downloadBlob(compiledPdf, 'gambar_pdffda.pdf');
      notify('success', 'Sukses Konversi', 'PDF rancangan gambar Anda berhasil dipersiapkan.');
    } catch (err) {
      console.error(err);
      notify('error', 'Kesalahan Konversi', 'Sistem gagal mengekstrak binary data dari gambar ke lembaran PDF.');
    } finally {
      setLoader({ show: false, title: '', message: '', progress: 0 });
    }
  };

  const handleOptionChange = (key, value) => {
    setImgOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const orOptText = imgOptions.orientation === 'portrait' ? 'Potret' : 'Lansekap';
  const mgOptText =
    imgOptions.margin === 'none'
      ? 'Tanpa Margin'
      : imgOptions.margin === 'small'
      ? 'Margin 12px'
      : 'Margin 24px';

  return (
    <section id="panel-img" className="tab-panel space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Sidebar Setup & Options */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5">
            <div className="space-y-2">
              <h3 className="text-xs font-bold font-mono text-blue-400 tracking-widest uppercase">Konversi Gambar</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Impor kumpulan foto atau file gambar untuk disalin dalam lembaran dokumen PDF rapi.
              </p>
            </div>

            {/* Upload Drag/Drop */}
            <div
              id="dropzone-img"
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
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
              />
              <div className="space-y-2">
                <div className="mx-auto h-10 w-10 text-white/50 flex items-center justify-center bg-white/5 rounded-full border border-white/10 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1c0 1.25.1 1.75.5 2" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                  Klik untuk ambil gambar
                </div>
                <div className="text-[10px] text-white/40">Mendukung JPG, JPEG, PNG</div>
              </div>
            </div>

            {/* Options Custom Setting */}
            <div className="space-y-4 border-t border-white/10 pt-4">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">
                Pengaturan Layout Halaman
              </h4>

              {/* Page Size Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Ukuran Kertas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOptionChange('pageSize', 'A4')}
                    className={`px-3 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.pageSize === 'A4'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    A4 (210 &times; 297mm)
                  </button>
                  <button
                    onClick={() => handleOptionChange('pageSize', 'Letter')}
                    className={`px-3 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.pageSize === 'Letter'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    Letter (8.5 &times; 11")
                  </button>
                </div>
              </div>

              {/* Page Orientation Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Orientasi Kertas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOptionChange('orientation', 'portrait')}
                    className={`px-3 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.orientation === 'portrait'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    Potret (Portrait)
                  </button>
                  <button
                    onClick={() => handleOptionChange('orientation', 'landscape')}
                    className={`px-3 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.orientation === 'landscape'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    Lansekap (Landscape)
                  </button>
                </div>
              </div>

              {/* Image Margins */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70">Dimensi Margin Kertas</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleOptionChange('margin', 'none')}
                    className={`px-2 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.margin === 'none'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    Tanpa Margin
                  </button>
                  <button
                    onClick={() => handleOptionChange('margin', 'small')}
                    className={`px-2 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.margin === 'small'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    12px (Tipis)
                  </button>
                  <button
                    onClick={() => handleOptionChange('margin', 'large')}
                    className={`px-2 py-1.5 text-xs rounded-lg text-center cursor-pointer transition-all border ${
                      imgOptions.margin === 'large'
                        ? 'border-blue-500 bg-blue-600/30 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 font-medium hover:bg-white/10'
                    }`}
                  >
                    24px (Lebar)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Previews Workspace */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[380px]">
            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex justify-between items-center shrink-0">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-semibold">Kliping &amp; Urutan Gambar</h3>
              {imgFiles.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors cursor-pointer border border-red-500/20"
                >
                  Kosongkan Halaman
                </button>
              )}
            </div>

            {/* Empty State */}
            {imgFiles.length === 0 ? (
              <div id="empty-img" className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="p-4 bg-white/5 rounded-full text-white/40 border border-white/10">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a1 1 0 011.414 0L16 17m0 0l1-1m-1 1c0 1.25.1 1.75.5 2" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white/80">Gambar Belum Ditambahkan</h4>
                  <p className="text-[11px] text-white/45 mt-1 max-w-xs">
                    Pilih file gambar Anda di kolom kiri untuk menyusun tata letak PDF.
                  </p>
                </div>
              </div>
            ) : (
              /* Horizontal/Grid Preview area of Images */
              <div id="img-grid" className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[420px]">
                {imgFiles.map((item, index) => (
                  <div
                    key={item.id}
                    className="border border-white/10 rounded-xl p-2 bg-white/5 flex flex-col space-y-2 relative group hover:border-white/20 hover:bg-white/10 transition-all select-none"
                  >
                    {/* Dynamic mini preview */}
                    <div className="bg-black/30 rounded-lg overflow-hidden flex items-center justify-center relative aspect-[3/4] border border-white/5 shadow-md">
                      <img
                        src={item.objectUrl}
                        alt="Kliping"
                        className="w-full h-full object-cover"
                        draggable="false"
                      />
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>

                    {/* Actions navigation */}
                    <div className="flex items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => swapImgItem(item.id, -1)}
                          disabled={index === 0}
                          className="p-1 bg-black/40 border border-white/10 text-white/60 rounded-md hover:text-blue-400 hover:bg-white/5 cursor-pointer disabled:opacity-25"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => swapImgItem(item.id, 1)}
                          disabled={index === imgFiles.length - 1}
                          className="p-1 bg-black/40 border border-white/10 text-white/60 rounded-md hover:text-blue-400 hover:bg-white/5 cursor-pointer disabled:opacity-25"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                      <span className="text-[9px] font-mono text-white/55 truncate max-w-[40%]" title={item.filename}>
                        {item.filename}
                      </span>

                      <button
                        onClick={() => deleteImgItem(item.id)}
                        className="p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-md cursor-pointer transition-colors border border-transparent hover:border-red-500/10"
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

            {/* Action Footer with dynamic metrics */}
            {imgFiles.length > 0 && (
              <div className="bg-black/30 p-4 border-t border-white/10 flex justify-between items-center gap-4 shrink-0">
                <div className="text-xs font-mono text-white/40">
                  <span className="font-bold text-blue-400 text-sm">{imgFiles.length}</span> Gambar &bull;{' '}
                  <span className="text-white/40 font-mono text-[11px]">Kertas: </span>
                  <span className="font-bold text-blue-400 text-sm">
                    {imgOptions.pageSize} {orOptText} ({mgOptText})
                  </span>
                </div>
                <button
                  onClick={runImageToPdf}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg inline-flex items-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-blue-900/40"
                >
                  <span>Persiapkan &amp; Simpan</span>
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
