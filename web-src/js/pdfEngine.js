/**
 * Core PDF Processing & Compilation Engine
 * 100% Client-Side with zero Server requests.
 */

import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the pdfjs worker to run seamlessly from Cloudflare CDN matching the precise version installed.
const PDFJS_VERSION = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

/**
 * Renders all pages of a PDF into JPG text-images for previews.
 * @param {File} file Original PDF file object
 * @param {Function} onProgress Progress callback (currentPage, totalPages)
 * @returns {Promise<Object>} Object containing total page count and thumbnail assets
 */
export async function getPdfThumbnails(file, onProgress) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Load document using pdfjs
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const thumbnails = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      
      // Calculate viewport at low-res for optimized performance thumbnail preview
      const viewport = page.getViewport({ scale: 0.4 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render onto canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Convert canvas drawing to lightweight dataURL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      
      thumbnails.push({
        pageNumber: i,
        dataUrl,
        width: viewport.width,
        height: viewport.height
      });

      if (onProgress) {
        onProgress(i, numPages);
      }
    }

    return { numPages, thumbnails };
  } catch (err) {
    console.error('Engine render pdf thumbnail error:', err);
    throw err;
  }
}

/**
 * Merges multiple PDF files in the designated list array order.
 * @param {Array<File>} files Ordered file list
 * @param {Function} onProgress Progress callback
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfFiles(files, onProgress) {
  try {
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const donorPdf = await PDFDocument.load(arrayBuffer);
      
      const indices = Array.from({ length: donorPdf.getPageCount() }, (_, idx) => idx);
      const copiedPages = await mergedPdf.copyPages(donorPdf, indices);
      
      copiedPages.forEach((page) => mergedPdf.addPage(page));

      if (onProgress) {
        onProgress(i + 1, files.length);
      }
    }

    return await mergedPdf.save();
  } catch (err) {
    console.error('Engine merge files error:', err);
    throw err;
  }
}

/**
 * Extracts chosen pages or deletes them, producing a final PDF.
 * @param {File} file Source PDF
 * @param {Array<Number>} selectedPageNumbers Indices of pages (1-indexed)
 * @param {Boolean} isDeleteMode True to delete selected, false to keep only selected
 * @returns {Promise<Uint8Array>} Raw compilation buffer
 */
export async function processPagesSelection(file, selectedPageNumbers, isDeleteMode) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const originalPdf = await PDFDocument.load(arrayBuffer);
    const totalPages = originalPdf.getPageCount();
    const resultPdf = await PDFDocument.create();

    // Determine target page integers to copy (1-indexed)
    let pagesToKeep = [];
    if (isDeleteMode) {
      // Keep pages that are NOT selected
      for (let i = 1; i <= totalPages; i++) {
        if (!selectedPageNumbers.includes(i)) {
          pagesToKeep.push(i);
        }
      }
    } else {
      // Keep only selected pages
      pagesToKeep = [...selectedPageNumbers].sort((a, b) => a - b);
    }

    if (pagesToKeep.length === 0) {
      throw new Error('Hasil dokumen kosong. Silakan seleksi halaman terlebih dahulu.');
    }

    // Map 1-based page indices to 0-based index values for pdf-lib copy operation
    const indicesToCopy = pagesToKeep.map(num => num - 1);
    const copiedPages = await resultPdf.copyPages(originalPdf, indicesToCopy);
    copiedPages.forEach((page) => resultPdf.addPage(page));

    return await resultPdf.save();
  } catch (err) {
    console.error('Engine selection process error:', err);
    throw err;
  }
}

/**
 * Helper to convert any image file (PNG/JPG/WEBP etc) to white-background JPEG bytes
 * using canvas to ensure 100% compatibility with pdf-lib embedJpg function.
 * @param {File} file Image File
 * @returns {Promise<Uint8Array>} High quality source JPEG bytes
 */
function fileToJpgBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        const ctx = canvas.getContext('2d');
        // Paint solid white background to avoid transparent webp/png rendering issues
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas image conversion blob generation failed'));
            return;
          }
          const blobReader = new FileReader();
          blobReader.onloadend = () => {
            resolve(new Uint8Array(blobReader.result));
          };
          blobReader.readAsArrayBuffer(blob);
        }, 'image/jpeg', 0.85); // 0.85 quality compression
      };
      img.onerror = () => reject(new Error('Gagal merender file gambar untuk PDF embed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca resource file gambar'));
    reader.readAsDataURL(file);
  });
}

/**
 * Generates PDF from a list of image files.
 * @param {Array<File>} files Ordered list of image files
 * @param {Object} options Options containing: pageSize, orientation, margin
 * @param {Function} onProgress Progress callback
 * @returns {Promise<Uint8Array>} Combined PDF array bytes
 */
export async function imagesToPdf(files, options, onProgress) {
  try {
    const pdfDoc = await PDFDocument.create();

    // Standard paper sizes in points (72 points = 1 inch)
    const PAGE_SIZES = {
      A4: { width: 595.27, height: 841.89 },
      Letter: { width: 612.00, height: 792.00 }
    };

    const MARGIN_SIZES = {
      none: 0,
      small: 12,
      large: 24
    };

    const paper = PAGE_SIZES[options.pageSize] || PAGE_SIZES.A4;
    const marginSize = MARGIN_SIZES[options.margin] !== undefined ? MARGIN_SIZES[options.margin] : 0;

    let targetWidth = paper.width;
    let targetHeight = paper.height;

    // Flip dimensions if landscape setting is enabled
    if (options.orientation === 'landscape') {
      targetWidth = paper.height;
      targetHeight = paper.width;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Convert image file safely to high-quality JPEG bytes
      const jpegBytes = await fileToJpgBytes(file);
      const embeddedImage = await pdfDoc.embedJpg(jpegBytes);

      // Create new page inside PDF matching target page sizes
      const page = pdfDoc.addPage([targetWidth, targetHeight]);

      // Image sizing fitting box bounds inside margins
      const maxWidth = targetWidth - (2 * marginSize);
      const maxHeight = targetHeight - (2 * marginSize);

      const scaleWidth = maxWidth / embeddedImage.width;
      const scaleHeight = maxHeight / embeddedImage.height;
      
      // Best fit matching aspect ratio
      const scale = Math.min(scaleWidth, scaleHeight, 1);

      const drawWidth = embeddedImage.width * scale;
      const drawHeight = embeddedImage.height * scale;

      // Coordinate centering calculation (pdf-lib maps bottom-left as original (0,0))
      const drawX = marginSize + (maxWidth - drawWidth) / 2;
      const drawY = marginSize + (maxHeight - drawHeight) / 2;

      page.drawImage(embeddedImage, {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight
      });

      if (onProgress) {
        onProgress(i + 1, files.length);
      }
    }

    return await pdfDoc.save();
  } catch (err) {
    console.error('Engine images to PDF error:', err);
    throw err;
  }
}

/**
 * Reads metadata fields from a PDF file.
 * @param {File} file PDF file
 * @returns {Promise<Object>} Metadata fields and page count
 */
export async function getPdfMetadata(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
    
    const safeGet = (getter) => {
      try {
        return getter() || '';
      } catch (e) {
        console.warn('Failed to parse PDF metadata field:', e);
        return '';
      }
    };

    let creationDate = '';
    try {
      creationDate = pdfDoc.getCreationDate() ? pdfDoc.getCreationDate().toISOString() : '';
    } catch (e) {
      // Silent catch - Date field is empty or malformed
    }

    let modificationDate = '';
    try {
      modificationDate = pdfDoc.getModificationDate() ? pdfDoc.getModificationDate().toISOString() : '';
    } catch (e) {
      // Silent catch - Date field is empty or malformed
    }

    return {
      title: safeGet(() => pdfDoc.getTitle()),
      author: safeGet(() => pdfDoc.getAuthor()),
      subject: safeGet(() => pdfDoc.getSubject()),
      keywords: safeGet(() => pdfDoc.getKeywords()),
      producer: safeGet(() => pdfDoc.getProducer()),
      creator: safeGet(() => pdfDoc.getCreator()),
      creationDate,
      modificationDate,
      pageCount: pdfDoc.getPageCount()
    };
  } catch (err) {
    console.error('Engine get metadata error:', err);
    throw err;
  }
}

/**
 * Updates metadata fields of a PDF file and returns new PDF bytes.
 * @param {File} file PDF file
 * @param {Object} metadata New metadata values
 * @returns {Promise<Uint8Array>}
 */
export async function updatePdfMetadata(file, metadata) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    pdfDoc.setTitle(metadata.title || '');
    pdfDoc.setAuthor(metadata.author || '');
    pdfDoc.setSubject(metadata.subject || '');
    pdfDoc.setKeywords(metadata.keywords ? metadata.keywords.split(',').map(k => k.trim()).filter(Boolean) : []);
    pdfDoc.setProducer(metadata.producer || '');
    pdfDoc.setCreator(metadata.creator || '');
    
    if (metadata.creationDate) {
      try {
        pdfDoc.setCreationDate(new Date(metadata.creationDate));
      } catch (e) {
        console.warn('Failed to set creation date:', e);
      }
    }
    
    if (metadata.modificationDate) {
      try {
        pdfDoc.setModificationDate(new Date(metadata.modificationDate));
      } catch (e) {
        console.warn('Failed to set modification date:', e);
      }
    } else {
      pdfDoc.setModificationDate(new Date());
    }

    return await pdfDoc.save();
  } catch (err) {
    console.error('Engine update metadata error:', err);
    throw err;
  }
}

