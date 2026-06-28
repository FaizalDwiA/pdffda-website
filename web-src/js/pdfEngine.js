/**
 * Core PDF Processing & Compilation Engine
 * 100% Client-Side with zero Server requests.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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

/**
 * Helper to find column split point (gutter) on a page.
 */
function findColumnSplitPoint(items, minX, maxX) {
  if (maxX - minX < 200) return null;

  // Search splits between 10% and 60% of the content width to capture narrow sidebars
  const startSearch = minX + (maxX - minX) * 0.10;
  const endSearch = minX + (maxX - minX) * 0.60;

  let bestSplitX = null;
  let minCrossing = Infinity;

  // Search with higher precision (every 5 units)
  for (let x = startSearch; x <= endSearch; x += 5) {
    let crossingCount = 0;
    let leftCount = 0;
    let rightCount = 0;

    items.forEach(item => {
      const itemLeft = item.transform[4];
      const itemRight = itemLeft + (item.width || 40);
      
      if (itemLeft < x && itemRight > x) {
        crossingCount++;
      } else if (itemRight <= x) {
        leftCount++;
      } else if (itemLeft >= x) {
        rightCount++;
      }
    });

    // Check if it's a strong vertical split point
    if (crossingCount < minCrossing && leftCount >= 1 && rightCount >= 3) {
      minCrossing = crossingCount;
      bestSplitX = x;
    }
  }

  // Allow up to 3 crossing lines to handle minor overlapping items or line decorators
  return minCrossing <= 3 ? bestSplitX : null;
}

/**
 * Renders list of text items in a specific coordinate bounds column.
 */
function renderColumnHtml(columnItems, styles, minX, maxX) {
  if (columnItems.length === 0) return '';
  
  const linesMap = {};
  columnItems.forEach(item => {
    const y = item.transform[5];
    let foundKey = null;
    for (const key of Object.keys(linesMap)) {
      if (Math.abs(parseFloat(key) - y) <= 4) {
        foundKey = key;
        break;
      }
    }
    
    if (foundKey !== null) {
      linesMap[foundKey].push(item);
    } else {
      linesMap[y] = [item];
    }
  });

  const sortedY = Object.keys(linesMap).sort((a, b) => parseFloat(b) - parseFloat(a));

  let html = '';
  sortedY.forEach(y => {
    const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
    const firstItem = lineItems[0];
    const lineStart = firstItem.transform[4];
    const lineIndent = Math.max(0, Math.round(lineStart - minX));
    
    let lineSpansHtml = '';
    
    lineItems.forEach((item, index) => {
      const styleKey = item.fontName;
      const fontStyle = styles[styleKey] || {};
      const fontFamily = fontStyle.fontFamily || 'Calibri';
      
      const isBold = fontFamily.toLowerCase().includes('bold') || styleKey.toLowerCase().includes('bold');
      const isItalic = fontFamily.toLowerCase().includes('italic') || fontFamily.toLowerCase().includes('oblique') || styleKey.toLowerCase().includes('italic');
      
      const fontSize = Math.round(Math.abs(item.transform[0] || item.transform[3] || 11));
      
      let gapStyle = '';
      if (index > 0) {
        const prevItem = lineItems[index - 1];
        const prevWidth = prevItem.width || (prevItem.str.length * fontSize * 0.5);
        const prevRight = prevItem.transform[4] + prevWidth;
        const currLeft = item.transform[4];
        const gap = currLeft - prevRight;
        
        if (gap > 15) {
          gapStyle = `margin-left: ${Math.round(gap)}pt;`;
        } else {
          const needsSpace = !prevItem.str.endsWith(' ') && !item.str.startsWith(' ');
          if (needsSpace && gap > 0.5) {
            lineSpansHtml += ' ';
          }
        }
      }

      const escapedStr = item.str
        .replace(/&/g, '&amp;')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      lineSpansHtml += `<span style="${gapStyle} font-family: ${fontFamily}, sans-serif; font-size: ${fontSize}pt; font-weight: ${isBold ? 'bold' : 'normal'}; font-style: ${isItalic ? 'italic' : 'normal'};">${escapedStr}</span>`;
    });

    html += `<p style="margin-left: ${lineIndent}pt; line-height: 1.2; margin-bottom: 4pt;">${lineSpansHtml}</p>`;
  });

  return html;
}

/**
 * Renders all page items checking for multi-column grids.
 */
function renderItemsToHtml(items, styles, minX, maxX) {
  const splitPoint = findColumnSplitPoint(items, minX, maxX);
  
  if (splitPoint !== null) {
    const leftItems = [];
    const rightItems = [];
    
    items.forEach(item => {
      const itemLeft = item.transform[4];
      const itemRight = itemLeft + (item.width || 0);
      
      if (itemRight <= splitPoint) {
        leftItems.push(item);
      } else {
        rightItems.push(item);
      }
    });
    
    const leftHtml = renderColumnHtml(leftItems, styles, minX, splitPoint);
    const rightHtml = renderColumnHtml(rightItems, styles, splitPoint, maxX);
    
    // Dynamically calculate column widths based on the split point ratio
    let leftPercent = Math.round(((splitPoint - minX) / (maxX - minX)) * 100);
    leftPercent = Math.max(15, Math.min(85, leftPercent)); // Clamp between 15% and 85%
    const rightPercent = 100 - leftPercent;

    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 10pt;">
        <tr valign="top">
          <td width="${leftPercent}%" style="padding-right: 15pt;">
            ${leftHtml}
          </td>
          <td width="${rightPercent}%" style="padding-left: 15pt;">
            ${rightHtml}
          </td>
        </tr>
      </table>
    `;
  } else {
    return renderColumnHtml(items, styles, minX, maxX);
  }
}

/**
 * Converts PDF file to Word (.doc) formatted HTML Uint8Array content.
 * @param {File} file PDF file
 * @param {Function} onProgress Progress callback
 * @returns {Promise<Uint8Array>}
 */
export async function convertPdfToWord(file, onProgress) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let docHtml = '';

    docHtml += '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    docHtml += '<head><meta charset="utf-8"><title>Converted Document</title>';
    docHtml += `<style>
      body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.15; color: #000000; margin: 1in; }
      p { margin: 0 0 4pt 0; padding: 0; text-align: left; }
      .page-break { page-break-before: always; }
    </style></head><body>`;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items;
      const styles = textContent.styles || {};

      if (items.length === 0) {
        if (i > 1) {
          docHtml += '<div class="page-break"></div>';
        }
        continue;
      }

      // Find page bounds
      let minX = Infinity;
      let maxX = -Infinity;
      items.forEach(item => {
        if (item.str && item.str.trim() !== '') {
          const x = item.transform[4];
          const w = item.width || 40;
          if (x < minX) minX = x;
          if (x + w > maxX) maxX = x + w;
        }
      });
      
      if (minX === Infinity) minX = 0;
      if (maxX === -Infinity) maxX = 595; // A4 standard width default

      const pageHtml = renderItemsToHtml(items, styles, minX, maxX);

      if (i > 1) {
        docHtml += '<div class="page-break"></div>';
      }
      docHtml += pageHtml;

      if (onProgress) {
        onProgress(i, numPages);
      }
    }

    docHtml += '</body></html>';
    
    const encoder = new TextEncoder();
    return encoder.encode(docHtml);
  } catch (err) {
    console.error('Engine convert PDF to Word error:', err);
    throw err;
  }
}

/**
 * Embeds a signature image onto a specific page of a PDF document.
 * @param {File} pdfFile PDF file
 * @param {File} signatureFile Signature image file (PNG/JPG)
 * @param {Object} options Options containing pageIndex, x, y, width, height
 * @returns {Promise<Uint8Array>} Updated PDF bytes
 */
export async function embedSignatureToPdf(pdfFile, signatureFile, options) {
  try {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const imageBytes = await signatureFile.arrayBuffer();
    let embeddedImage;

    const lowerName = signatureFile.name.toLowerCase();
    if (lowerName.endsWith('.png') || signatureFile.type === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || signatureFile.type === 'image/jpeg') {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      throw new Error('Format gambar tidak didukung. Harap gunakan format PNG atau JPG/JPEG.');
    }

    const pages = pdfDoc.getPages();
    const pageIndex = options.pageIndex ?? 0;
    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error('Halaman target tidak valid.');
    }

    const targetPage = pages[pageIndex];

    targetPage.drawImage(embeddedImage, {
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
    });

    return await pdfDoc.save();
  } catch (err) {
    console.error('Engine embed signature error:', err);
    throw err;
  }
}

/**
 * Saves all edits (text, images, shapes) onto the respective pages of a PDF.
 * @param {File} pdfFile Original PDF file
 * @param {Array} edits Array of edit objects
 * @returns {Promise<Uint8Array>} Updated PDF bytes
 */
export async function saveEditedPdf(pdfFile, edits) {
  try {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    // Embed Standard Helvetica Font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Group edits by pageIndex
    const editsByPage = {};
    for (const edit of edits) {
      const idx = edit.pageIndex ?? 0;
      if (!editsByPage[idx]) {
        editsByPage[idx] = [];
      }
      editsByPage[idx].push(edit);
    }

    // Process each page
    for (const pageIdxStr of Object.keys(editsByPage)) {
      const pageIdx = parseInt(pageIdxStr);
      if (pageIdx < 0 || pageIdx >= pages.length) continue;
      const targetPage = pages[pageIdx];
      const pageEdits = editsByPage[pageIdx];

      for (const edit of pageEdits) {
        if (edit.type === 'text') {
          const { r, g, b } = hexToRgb(edit.color || '#000000');
          targetPage.drawText(edit.text || '', {
            x: edit.x,
            y: edit.y,
            size: edit.fontSize || 12,
            font: helveticaFont,
            color: rgb(r, g, b),
          });
        } else if (edit.type === 'whiteout') {
          const { r, g, b } = hexToRgb(edit.color || '#ffffff');
          targetPage.drawRectangle({
            x: edit.x,
            y: edit.y,
            width: edit.width,
            height: edit.height,
            color: rgb(r, g, b),
          });
        } else if (edit.type === 'image') {
          if (!edit.file) continue;
          const imageBytes = await edit.file.arrayBuffer();
          let embeddedImage;
          const lowerName = edit.file.name.toLowerCase();
          if (lowerName.endsWith('.png') || edit.file.type === 'image/png') {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || edit.file.type === 'image/jpeg') {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            try {
              embeddedImage = await pdfDoc.embedPng(imageBytes);
            } catch {
              embeddedImage = await pdfDoc.embedJpg(imageBytes);
            }
          }
          targetPage.drawImage(embeddedImage, {
            x: edit.x,
            y: edit.y,
            width: edit.width,
            height: edit.height,
          });
        }
      }
    }

    return await pdfDoc.save();
  } catch (err) {
    console.error('Engine saveEditedPdf error:', err);
    throw err;
  }
}

function hexToRgb(hex) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return { r, g, b };
}



