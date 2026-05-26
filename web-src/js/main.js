/**
 * Client-Side PDF Utility Suite - Main UI Manager
 */

import '../index.css';
import { PDFDocument } from 'pdf-lib';
import { getPdfThumbnails, mergePdfFiles, processPagesSelection, imagesToPdf } from './pdfEngine.js';

// Application State Store
const state = {
  activeTab: 'panel-merge',
  
  // Mode 1: Merge Files
  mergeFiles: [], // Array representing: { id, file, pageCount, sizeStr }
  
  // Mode 2: Split / Delete Single File
  splitFile: null,
  splitThumbnails: [], // Array representing: { pageNumber, dataUrl, selected: false }
  
  // Mode 3: Image to PDF File list
  imgFiles: [], // Array representing: { id, file, objectUrl }
  imgOptions: {
    pageSize: 'A4',
    orientation: 'portrait',
    margin: 'none'
  }
};

/**
 * Unique ID generator for row elements
 */
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Format raw bytes into human-readable indicators
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Custom iframe-compatible toast notification utility in slate/indigo design
 */
function notify(type, title, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-4';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderBg = type === 'error' 
    ? 'bg-red-50 border-red-200 text-red-900 shadow-red-500/5' 
    : 'bg-green-50 border-green-200 text-green-900 shadow-green-500/5';
  const textTitle = type === 'error' ? 'text-red-800' : 'text-green-800';
  const iconHex = type === 'error' 
    ? `<svg class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
    : `<svg class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  toast.className = `p-4 border rounded-xl flex items-start space-x-3 shadow-md transform translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto ${borderBg}`;
  toast.innerHTML = `
    <div class="shrink-0 mt-0.5">${iconHex}</div>
    <div class="flex-1">
      <h5 class="text-xs font-bold leading-none ${textTitle}">${title}</h5>
      <p class="text-[11px] text-slate-500 mt-1 leading-normal font-medium">${message}</p>
    </div>
  `;

  container.appendChild(toast);

  // Trigger Slide & Reveal transition
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Self-destruct sequences
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

/**
 * Triggers loading spinner modals with values
 */
function setLoader(show, title = '', message = '', progressVal = 0) {
  const overlay = document.getElementById('loader-overlay');
  const titleEl = document.getElementById('loader-title');
  const msgEl = document.getElementById('loader-message');
  const barEl = document.getElementById('loader-progressbar');
  const textEl = document.getElementById('loader-progress-text');

  if (show) {
    if (title) titleEl.textContent = title;
    if (message) msgEl.textContent = message;
    barEl.style.width = `${progressVal}%`;
    textEl.textContent = `${Math.round(progressVal)}% Selesai`;
    
    overlay.classList.remove('opacity-0', 'pointer-events-none');
  } else {
    overlay.classList.add('opacity-0', 'pointer-events-none');
  }
}

/**
 * Initiates trigger-based file downloads
 */
function downloadBlob(uint8Array, defaultName) {
  const blob = new Blob([uint8Array], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const tempLink = document.createElement('a');
  tempLink.href = downloadUrl;
  tempLink.download = defaultName;
  document.body.appendChild(tempLink);
  
  tempLink.click();
  
  // Revocation for healthy memory footprint
  setTimeout(() => {
    document.body.removeChild(tempLink);
    URL.revokeObjectURL(downloadUrl);
  }, 300);
}

/* ==========================================
   INITIALIZER & SYSTEM ROUTINES
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTabSwitcher();
  initMergeMode();
  initSplitMode();
  initImageToPdfMode();
  
  // Drag and drop prevent default globals
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, (e) => e.preventDefault(), false);
  });
});

/**
 * TAB MANAGEMENT VIEW CONTROLS
 */
function initTabSwitcher() {
  const tabs = document.querySelectorAll('#tabs-navigation button');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanelId = tab.getAttribute('data-target');
      
      // Toggle Tabs
      tabs.forEach(t => {
        t.className = "flex-1 py-2.5 rounded-lg text-center font-medium text-xs text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center space-x-2 transition-all cursor-pointer focus:outline-hidden";
      });
      tab.className = "active-tab flex-1 py-2.5 rounded-lg text-center font-medium text-xs bg-blue-600 text-white shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer focus:outline-hidden";

      // Toggle Panels
      panels.forEach(panel => {
        if (panel.id === targetPanelId) {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      });

      state.activeTab = targetPanelId;
    });
  });
}


/* ==========================================
   MODE 1: MERGE PDF CONTROLLERS
   ========================================== */

function initMergeMode() {
  const dropzone = document.getElementById('dropzone-merge');
  const fileInput = document.getElementById('input-merge');
  const clearBtn = document.getElementById('btn-clear-merge');
  const runBtn = document.getElementById('btn-run-merge');

  // Multi-upload actions
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => registerMergeFiles(e.target.files));

  // Drag highlights
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('border-indigo-500', 'bg-indigo-50/20'), false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/20'), false);
  });
  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    registerMergeFiles(dt.files);
  });

  // Clear Lists
  clearBtn.addEventListener('click', () => {
    state.mergeFiles = [];
    renderMergeWorkspace();
    notify('success', 'Daftar Kosong', 'Kumpulan antrean file berhasil dibersihkan.');
  });

  // Action Run Merge
  runBtn.addEventListener('click', async () => {
    if (state.mergeFiles.length < 2) {
      notify('error', 'Peringatan', 'Silakan pilih minimal 2 file PDF untuk dapat digabungkan.');
      return;
    }

    setLoader(true, 'Menggabungkan PDF', 'Sedang memuat data binary dokumen...', 10);
    
    try {
      const sortedFilesOnly = state.mergeFiles.map(item => item.file);
      const mergedBytes = await mergePdfFiles(sortedFilesOnly, (currentIndex, totalIndex) => {
        const percent = (currentIndex / totalIndex) * 100;
        setLoader(true, 'Menggabungkan PDF', `Dokumen ${currentIndex} dari ${totalIndex} selesai digabung.`, percent);
      });

      downloadBlob(mergedBytes, 'gabungan_workspace.pdf');
      notify('success', 'Aksi Berhasil', 'PDF berhasil digabungkan dan siap diunduh.');
    } catch (err) {
      console.error(err);
      notify('error', 'Gagalan Kompilasi', 'Terjadi kesalahan sistem ketika menyusun lembar PDF Anda.');
    } finally {
      setLoader(false);
    }
  });
}

/**
 * Reads newly uploaded PDFs to state array
 */
async function registerMergeFiles(files) {
  if (!files || files.length === 0) return;
  
  const validPdfs = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  
  if (validPdfs.length === 0) {
    notify('error', 'Format Salah', 'Hanya mendukung dokumen format PDF.');
    return;
  }

  setLoader(true, 'Menganalisis Dokumen', 'Membuka metadata detail halaman PDF...', 30);

  let loadedCounter = 0;
  for (const file of validPdfs) {
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buffer);
      const pages = pdf.getPageCount();

      state.mergeFiles.push({
        id: generateId(),
        file: file,
        filename: file.name,
        sizeStr: formatBytes(file.size),
        pageCount: pages
      });
      loadedCounter++;
    } catch (err) {
      console.error(err);
      notify('error', 'Gagal Membuka File', `File "${file.name}" diproteksi kata sandi atau korup.`);
    }
  }

  setLoader(false);
  document.getElementById('input-merge').value = ''; // refresh input slot
  
  if (loadedCounter > 0) {
    renderMergeWorkspace();
    notify('success', 'File Ditambahkan', `${loadedCounter} Dokumen PDF berhasil masuk antrean.`);
  }
}

/**
 * Re-renders Mode 1: Merge visual rows
 */
function renderMergeWorkspace() {
  const container = document.getElementById('list-merge');
  const emptyView = document.getElementById('empty-merge');
  const clearBtn = document.getElementById('btn-clear-merge');
  const footView = document.getElementById('foot-merge');
  const countSpan = document.getElementById('merge-file-count');
  const pagesSpan = document.getElementById('merge-page-count');

  if (state.mergeFiles.length === 0) {
    container.classList.add('hidden');
    emptyView.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    footView.classList.add('hidden');
    return;
  }

  emptyView.classList.add('hidden');
  container.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
  footView.classList.remove('hidden');

  container.innerHTML = '';
  
  let totalCumulativePages = 0;

  state.mergeFiles.forEach((item, index) => {
    totalCumulativePages += item.pageCount;
    
    const row = document.createElement('div');
    row.className = "flex items-center justify-between p-4 hover:bg-white/5 border-b border-white/5 transition-all font-sans";
    
    row.innerHTML = `
      <div class="flex items-center space-x-3 truncate max-w-[65%]">
        <div class="shrink-0 h-8 w-8 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center font-bold text-xs uppercase font-mono border border-blue-500/20 shadow-xs">
          PDF
        </div>
        <div class="truncate">
          <h4 class="text-xs font-semibold text-white/95 truncate" title="${item.filename}">${item.filename}</h4>
          <p class="text-[10px] text-white/40 font-mono font-medium">${item.sizeStr} &bull; <span class="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">${item.pageCount} Hal</span></p>
        </div>
      </div>
      
      <div class="flex items-center space-x-2">
        <!-- Reorder Actions btn -->
        <div class="inline-flex rounded-lg border border-white/10 bg-black/40 overflow-hidden shadow-sm">
          <button class="btn-move-up p-1 text-white/60 hover:text-blue-450 hover:bg-white/5 cursor-pointer focus:outline-hidden disabled:opacity-20" data-id="${item.id}" ${index === 0 ? 'disabled' : ''}>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button class="btn-move-down p-1 text-white/60 hover:text-blue-450 hover:bg-white/5 cursor-pointer focus:outline-hidden border-l border-white/5 disabled:opacity-20" data-id="${item.id}" ${index === state.mergeFiles.length - 1 ? 'disabled' : ''}>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <!-- Delete item btn -->
        <button class="btn-delete-row p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors focus:outline-hidden border border-transparent hover:border-red-500/10" data-id="${item.id}">
          <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;

    container.appendChild(row);
  });

  // Attach button events
  container.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', () => moveMergeFile(btn.getAttribute('data-id'), -1));
  });
  container.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', () => moveMergeFile(btn.getAttribute('data-id'), 1));
  });
  container.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', () => deleteMergeFile(btn.getAttribute('data-id')));
  });

  // Update numbers
  countSpan.textContent = state.mergeFiles.length;
  pagesSpan.textContent = totalCumulativePages;
}

function moveMergeFile(id, direction) {
  const index = state.mergeFiles.findIndex(item => item.id === id);
  if (index === -1) return;
  
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.mergeFiles.length) return;

  // Swap spaces
  const temporary = state.mergeFiles[index];
  state.mergeFiles[index] = state.mergeFiles[targetIndex];
  state.mergeFiles[targetIndex] = temporary;

  renderMergeWorkspace();
}

function deleteMergeFile(id) {
  state.mergeFiles = state.mergeFiles.filter(item => item.id !== id);
  renderMergeWorkspace();
}


/* ==========================================
   MODE 2: SPLIT & DELETE PAGES CONTROLLERS
   ========================================== */

function initSplitMode() {
  const dropzone = document.getElementById('dropzone-split');
  const fileInput = document.getElementById('input-split');
  const triggerDivPrompt = document.getElementById('split-uploader-prompt');
  const triggerDivActive = document.getElementById('split-uploader-active');
  const changeBtn = document.getElementById('btn-change-split');
  const runExtractBtn = document.getElementById('btn-extract');
  const runDeleteBtn = document.getElementById('btn-delete');

  // Multi-triggers
  dropzone.addEventListener('click', (e) => {
    if (e.target.id === 'btn-change-split' || e.target.closest('#btn-change-split')) return;
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => loadSplitFile(e.target.files[0]));

  // Drag overlays
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('border-indigo-500', 'bg-indigo-50/20'), false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/20'), false);
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    loadSplitFile(file);
  });

  // Re-upload switch
  changeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Action Helpers: Multi selector triggers
  document.getElementById('pilih-semua').addEventListener('click', () => toggleAllSplit(true));
  document.getElementById('bersihkan-pilihan').addEventListener('click', () => toggleAllSplit(false));
  document.getElementById('balikkan-pilihan').addEventListener('click', () => invertAllSplit());

  // Execute compile processes
  runExtractBtn.addEventListener('click', () => processSplitExecution(false));
  runDeleteBtn.addEventListener('click', () => processSplitExecution(true));
}

/**
 * Parses single target PDF
 */
async function loadSplitFile(file) {
  if (!file) return;

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    notify('error', 'Format Salah', 'Hanya mendukung berkas dokumen PDF.');
    return;
  }

  state.splitFile = file;

  // Render original info bar
  document.getElementById('split-file-name').textContent = file.name;
  document.getElementById('split-file-size').textContent = formatBytes(file.size);
  
  document.getElementById('split-uploader-prompt').classList.add('hidden');
  document.getElementById('split-uploader-active').classList.remove('hidden');

  setLoader(true, 'Rendisi Halaman', 'Membuat thumbnail visual lembaran PDF...', 1);

  try {
    const results = await getPdfThumbnails(file, (currPage, totalPages) => {
      const percentage = (currPage / totalPages) * 100;
      setLoader(true, 'Rendisi Halaman', `Melukis halaman ${currPage} dari ${totalPages}...`, percentage);
    });

    state.splitThumbnails = results.thumbnails.map(t => ({
      ...t,
      selected: false
    }));

    // Reveal UI controls
    document.getElementById('split-actions').classList.remove('hidden');
    renderSplitGrid();
    notify('success', 'PDF Dimuat', 'Pratinjau halaman berhasil dirender dengan aman.');
  } catch (err) {
    console.error(err);
    notify('error', 'Rendering Gagal', 'Sandi pengaman aktif, silakan decrypt file PDF terlebih dahulu.');
    
    // reset visual state
    state.splitFile = null;
    state.splitThumbnails = [];
    document.getElementById('split-uploader-active').classList.add('hidden');
    document.getElementById('split-uploader-prompt').classList.remove('hidden');
    document.getElementById('split-actions').classList.add('hidden');
    document.getElementById('empty-split').classList.remove('hidden');
    document.getElementById('split-grid').classList.add('hidden');
  } finally {
    setLoader(false);
  }
}

/**
 * Re-draws grid cards
 */
function renderSplitGrid() {
  const gridContainer = document.getElementById('split-grid');
  const emptyState = document.getElementById('empty-split');

  if (state.splitThumbnails.length === 0) {
    gridContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  gridContainer.classList.remove('hidden');
  
  gridContainer.innerHTML = '';

  state.splitThumbnails.forEach((thumb, idx) => {
    const card = document.createElement('div');
    const selectedClass = thumb.selected 
      ? 'border-2 border-blue-500 bg-white/10 shadow-2xl ring-2 ring-blue-500/20' 
      : 'border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10';

    card.className = `rounded-xl p-2 cursor-pointer transition-all duration-150 flex flex-col space-y-2 select-none relative group ${selectedClass}`;
    
    card.innerHTML = `
      <!-- Thumbnail box content -->
      <div class="bg-[#0c111d]/50 rounded-lg overflow-hidden flex items-center justify-center relative aspect-[3/4] border border-white/5 shadow-md">
        <img src="${thumb.dataUrl}" alt="Hal ${thumb.pageNumber}" class="w-full h-full object-contain" draggable="false" />
        
        <!-- Hover background filter -->
        <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <!-- Selection Check bubble visual overlay -->
        <div class="checkbox-visual absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center border transition-all ${thumb.selected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/40 border-white/30 text-transparent'}">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      
      <!-- Footer tag detail -->
      <div class="text-center font-mono text-[10px] py-0.5 font-bold ${thumb.selected ? 'text-blue-400' : 'text-white/50'}">
        Hal ${thumb.pageNumber}
      </div>
    `;

    card.addEventListener('click', () => {
      state.splitThumbnails[idx].selected = !state.splitThumbnails[idx].selected;
      renderSplitGrid();
      updateSplitMetrics();
    });

    gridContainer.appendChild(card);
  });

  updateSplitMetrics();
}

/**
 * Updates selection statistics banners
 */
function updateSplitMetrics() {
  const selectedCount = state.splitThumbnails.filter(t => t.selected).length;
  const totalCount = state.splitThumbnails.length;
  document.getElementById('selected-badge').textContent = `${selectedCount} dari ${totalCount}`;
}

function toggleAllSplit(flag) {
  state.splitThumbnails.forEach(t => t.selected = flag);
  renderSplitGrid();
}

function invertAllSplit() {
  state.splitThumbnails.forEach(t => t.selected = !t.selected);
  renderSplitGrid();
}

/**
 * Initiates action process of split output
 */
async function processSplitExecution(isDeleteMode) {
  if (!state.splitFile) {
    notify('error', 'Kekosongan data', 'Silakan pilih dokumen PDF terlebih dahulu.');
    return;
  }

  const selectedPages = state.splitThumbnails.filter(t => t.selected).map(t => t.pageNumber);

  if (selectedPages.length === 0) {
    notify('error', 'Seleksi Kosong', 'Harap klik setidaknya 1 lembar halaman pratinjau untuk memulai.');
    return;
  }

  const actWord = isDeleteMode ? 'Menghapus' : 'Mengekstrak';
  setLoader(true, `${actWord} Halaman`, 'Menyusun segmentasi halaman binary...', 20);

  try {
    const parsedBytes = await processPagesSelection(state.splitFile, selectedPages, isDeleteMode);
    
    const operationSlug = isDeleteMode ? 'terpotong' : 'ekstrak';
    const originalShortName = state.splitFile.name.replace('.pdf', '');
    const filenameResult = `${originalShortName}_${operationSlug}.pdf`;
    
    downloadBlob(parsedBytes, filenameResult);
    notify('success', 'Tindakan Selesai', `Lembaran PDF Anda berhasil dibuat.`);
  } catch (err) {
    console.error(err);
    notify('error', 'Gagal Operasi', err.message || 'Terjadi kesalahan internal pemotongan halaman.');
  } finally {
    setLoader(false);
  }
}


/* ==========================================
   MODE 3: IMAGES TO PDF CONTROLLERS
   ========================================== */

function initImageToPdfMode() {
  const dropzone = document.getElementById('dropzone-img');
  const fileInput = document.getElementById('input-img');
  const clearBtn = document.getElementById('btn-clear-img');
  const compileBtn = document.getElementById('btn-run-img');

  // Trigger file selection
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => registerImageFiles(e.target.files));

  // Drag visual alerts
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('border-indigo-500', 'bg-indigo-50/20'), false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/20'), false);
  });
  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    registerImageFiles(dt.files);
  });

  // Clear images
  clearBtn.addEventListener('click', () => {
    state.imgFiles.forEach(item => URL.revokeObjectURL(item.objectUrl));
    state.imgFiles = [];
    renderImgWorkspace();
    notify('success', 'Konversi Direset', 'Kliping kumpulan gambar berhasil dibersihkan.');
  });

  // Init layout configuration selectors
  initLayoutSelectors();

  // Action convert and download images
  compileBtn.addEventListener('click', async () => {
    if (state.imgFiles.length === 0) {
      notify('error', 'Berkas Kosong', 'Silakan pilih gambar terlebih dahulu sebelum mengonversi.');
      return;
    }

    setLoader(true, 'Mengonversi Gambar', 'Menyesuaikan dimensi resolusi gambaran...', 10);

    try {
      const filesArr = state.imgFiles.map(i => i.file);
      const compiledPdf = await imagesToPdf(filesArr, state.imgOptions, (curr, total) => {
        const percent = (curr / total) * 100;
        setLoader(true, 'Menyalin Halaman', `Melukis gambar ${curr} dari ${total} halaman ke berkas...`, percent);
      });

      downloadBlob(compiledPdf, 'gambar_terkompilasi.pdf');
      notify('success', 'Sukses Konversi', 'PDF rancangan gambar Anda berhasil dipersiapkan.');
    } catch (err) {
      console.error(err);
      notify('error', 'Kesalahan Konversi', 'Sistem gagal mengekstrak binary data dari gambar ke lembaran PDF.');
    } finally {
      setLoader(false);
    }
  });
}

function initLayoutSelectors() {
  // Option 1: Page Size selections
  const sizes = {
    'size-a4': 'A4',
    'size-letter': 'Letter'
  };
  Object.keys(sizes).forEach(btnId => {
    document.getElementById(btnId).addEventListener('click', () => {
      // Toggle CSS Styles
      Object.keys(sizes).forEach(id => {
        document.getElementById(id).className = 'px-3 py-1.5 text-xs font-medium rounded-lg text-center cursor-pointer transition-all border border-white/10 bg-white/5 text-white/70 hover:bg-white/10';
      });
      document.getElementById(btnId).className = 'px-3 py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer transition-all border border-blue-500 bg-blue-600/30 text-white shadow-sm';
      
      state.imgOptions.pageSize = sizes[btnId];
      updateImgMetrics();
    });
  });

  // Option 2: Page Orientation selections
  const orients = {
    'orient-portrait': 'portrait',
    'orient-landscape': 'landscape'
  };
  Object.keys(orients).forEach(btnId => {
    document.getElementById(btnId).addEventListener('click', () => {
      Object.keys(orients).forEach(id => {
        document.getElementById(id).className = 'px-3 py-1.5 text-xs font-medium rounded-lg text-center cursor-pointer transition-all border border-white/10 bg-white/5 text-white/70 hover:bg-white/10';
      });
      document.getElementById(btnId).className = 'px-3 py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer transition-all border border-blue-500 bg-blue-600/30 text-white shadow-sm';

      state.imgOptions.orientation = orients[btnId];
      updateImgMetrics();
    });
  });

  // Option 3: Margins selections
  const margins = {
    'margin-none': 'none',
    'margin-small': 'small',
    'margin-large': 'large'
  };
  Object.keys(margins).forEach(btnId => {
    document.getElementById(btnId).addEventListener('click', () => {
      Object.keys(margins).forEach(id => {
        document.getElementById(id).className = 'px-2 py-1.5 text-xs font-medium rounded-lg text-center cursor-pointer transition-all border border-white/10 bg-white/5 text-white/70 hover:bg-white/10';
      });
      document.getElementById(btnId).className = 'px-2 py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer transition-all border border-blue-500 bg-blue-600/30 text-white shadow-sm';

      state.imgOptions.margin = margins[btnId];
      updateImgMetrics();
    });
  });
}

function registerImageFiles(files) {
  if (!files || files.length === 0) return;

  const validFormats = ['image/jpeg', 'image/jpg', 'image/png'];
  const loadedArr = Array.from(files).filter(f => validFormats.includes(f.type) || f.name.toLowerCase().match(/\.(jpg|jpeg|png)$/));

  if (loadedArr.length === 0) {
    notify('error', 'Format gambar salah', 'Kolom ini eksklusif mendukung format gambar JPG, JPEG, atau PNG.');
    return;
  }

  loadedArr.forEach(file => {
    state.imgFiles.push({
      id: generateId(),
      file: file,
      filename: file.name,
      objectUrl: URL.createObjectURL(file) // temporary local display url
    });
  });

  document.getElementById('input-img').value = ''; // erase cache
  renderImgWorkspace();
  notify('success', 'Gambar Masuk', `${loadedArr.length} Foto dimasukkan ke koleksi halaman.`);
}

/**
 * Reorders/re-renders image boxes
 */
function renderImgWorkspace() {
  const container = document.getElementById('img-grid');
  const emptyState = document.getElementById('empty-img');
  const clearBtn = document.getElementById('btn-clear-img');
  const footView = document.getElementById('foot-img');

  if (state.imgFiles.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    footView.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
  footView.classList.remove('hidden');

  container.innerHTML = '';

  state.imgFiles.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = "border border-white/10 rounded-xl p-2 bg-white/5 flex flex-col space-y-2 relative group hover:border-white/20 hover:bg-white/10 transition-all select-none";
    
    card.innerHTML = `
      <!-- Dynamic mini preview -->
      <div class="bg-black/30 rounded-lg overflow-hidden flex items-center justify-center relative aspect-[3/4] border border-white/5 shadow-md">
        <img src="${item.objectUrl}" alt="Kliping" class="w-full h-full object-cover" draggable="false" />
        <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
      
      <!-- Actions navigation -->
      <div class="flex items-center justify-between gap-1.5 pt-0.5">
        <div class="flex items-center space-x-1 shrink-0">
          <button class="btn-img-prev p-1 bg-black/40 border border-white/10 text-white/60 rounded-md hover:text-blue-400 hover:bg-white/5 cursor-pointer disabled:opacity-25" data-id="${item.id}" ${index === 0 ? 'disabled' : ''}>
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button class="btn-img-next p-1 bg-black/40 border border-white/10 text-white/60 rounded-md hover:text-blue-400 hover:bg-white/5 cursor-pointer disabled:opacity-25" data-id="${item.id}" ${index === state.imgFiles.length - 1 ? 'disabled' : ''}>
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <span class="text-[9px] font-mono text-white/55 truncate max-w-[40%]">${item.filename}</span>
        
        <button class="btn-img-delete p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-md cursor-pointer transition-colors border border-transparent hover:border-red-500/10" data-id="${item.id}">
          <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;

    // Swap routines on image item
    card.querySelector('.btn-img-prev').addEventListener('click', () => swapImgItem(item.id, -1));
    card.querySelector('.btn-img-next').addEventListener('click', () => swapImgItem(item.id, 1));
    card.querySelector('.btn-img-delete').addEventListener('click', () => deleteImgItem(item.id));

    container.appendChild(card);
  });

  updateImgMetrics();
}

function swapImgItem(id, direction) {
  const index = state.imgFiles.findIndex(item => item.id === id);
  if (index === -1) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.imgFiles.length) return;

  const original = state.imgFiles[index];
  state.imgFiles[index] = state.imgFiles[targetIndex];
  state.imgFiles[targetIndex] = original;

  renderImgWorkspace();
}

function deleteImgItem(id) {
  const item = state.imgFiles.find(i => i.id === id);
  if (item) URL.revokeObjectURL(item.objectUrl); // memory layout cleanup
  
  state.imgFiles = state.imgFiles.filter(i => i.id !== id);
  renderImgWorkspace();
}

function updateImgMetrics() {
  const labelCount = document.getElementById('img-file-count');
  const labelMeta = document.getElementById('img-meta-desc');

  const psOpt = state.imgOptions.pageSize;
  const orOpt = state.imgOptions.orientation === 'portrait' ? 'Potret' : 'Lansekap';
  const mgOpt = state.imgOptions.margin === 'none' ? 'Tanpa Margin' : state.imgOptions.margin === 'small' ? 'Margin 12px' : 'Margin 24px';

  labelCount.textContent = state.imgFiles.length;
  labelMeta.textContent = `${psOpt} ${orOpt} (${mgOpt})`;
}
