/*
 * PDF export and compression workflow
 */

/* ---------- PDF Export ---------- */
const PDF_TARGET_MIN_BYTES = 2 * 1024 * 1024;
const PDF_TARGET_MAX_BYTES = 5 * 1024 * 1024;
const PDF_TARGET_IDEAL_BYTES = 3.5 * 1024 * 1024;
const PDF_MARGIN_MM = 6;
const PDF_BLOCK_GAP_MM = 4;

function createPdfDocument() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    return {
        pdf,
        margin: PDF_MARGIN_MM,
        gap: PDF_BLOCK_GAP_MM,
        usableWidth: pageWidth - (PDF_MARGIN_MM * 2),
        usableHeight: pageHeight - (PDF_MARGIN_MM * 2),
        currentY: PDF_MARGIN_MM
    };
}

function downscaleCanvas(sourceCanvas, maxWidth) {
    if (!sourceCanvas || sourceCanvas.width <= maxWidth) {
        return sourceCanvas;
    }

    const ratio = maxWidth / sourceCanvas.width;
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = Math.max(1, Math.round(sourceCanvas.width * ratio));
    scaledCanvas.height = Math.max(1, Math.round(sourceCanvas.height * ratio));

    const scaledContext = scaledCanvas.getContext('2d', { alpha: false });
    scaledContext.imageSmoothingEnabled = true;
    scaledContext.imageSmoothingQuality = 'high';
    scaledContext.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    return scaledCanvas;
}

function addCanvasSliceToPdf(doc, sliceCanvas, jpegQuality, compressionMode) {
    const imgData = sliceCanvas.toDataURL('image/jpeg', jpegQuality);
    const imgHeightMm = (sliceCanvas.height * doc.usableWidth) / sliceCanvas.width;
    doc.pdf.addImage(imgData, 'JPEG', doc.margin, doc.currentY, doc.usableWidth, imgHeightMm, undefined, compressionMode);
    doc.currentY += imgHeightMm + doc.gap;
}

function addCanvasBlockToPdf(doc, sourceCanvas, jpegQuality, compressionMode) {
    const blockHeightMm = (sourceCanvas.height * doc.usableWidth) / sourceCanvas.width;

    if (blockHeightMm <= doc.usableHeight) {
        if (doc.currentY > doc.margin && (doc.currentY + blockHeightMm) > (doc.margin + doc.usableHeight)) {
            doc.pdf.addPage();
            doc.currentY = doc.margin;
        }
        addCanvasSliceToPdf(doc, sourceCanvas, jpegQuality, compressionMode);
        return;
    }

    if (doc.currentY > doc.margin) {
        doc.pdf.addPage();
        doc.currentY = doc.margin;
    }

    const pagePixelHeight = Math.floor((sourceCanvas.width * doc.usableHeight) / doc.usableWidth);
    let offsetY = 0;

    while (offsetY < sourceCanvas.height) {
        const sliceHeight = Math.min(pagePixelHeight, sourceCanvas.height - offsetY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sourceCanvas.width;
        sliceCanvas.height = sliceHeight;
        const sliceContext = sliceCanvas.getContext('2d', { alpha: false });
        sliceContext.imageSmoothingEnabled = true;
        sliceContext.imageSmoothingQuality = 'high';
        sliceContext.drawImage(
            sourceCanvas,
            0,
            offsetY,
            sourceCanvas.width,
            sliceHeight,
            0,
            0,
            sourceCanvas.width,
            sliceHeight
        );

        addCanvasSliceToPdf(doc, sliceCanvas, jpegQuality, compressionMode);
        offsetY += sliceHeight;

        if (offsetY < sourceCanvas.height) {
            doc.pdf.addPage();
            doc.currentY = doc.margin;
        }
    }
}

function getPrintableBlocks(targetNode) {
    const blocks = [];
    const sections = Array.from(targetNode.children).filter((section) => window.getComputedStyle(section).display !== 'none');

    sections.forEach((section) => {
        Array.from(section.children).forEach((child) => {
            if (window.getComputedStyle(child).display === 'none') {
                return;
            }

            if (["summary-section", "insights-section", "mismatch-section", "audit-section"].includes(child.id)) {
                Array.from(child.children).forEach((nestedChild) => {
                    if (window.getComputedStyle(nestedChild).display !== 'none' && nestedChild.getBoundingClientRect().height > 0) {
                        blocks.push(nestedChild);
                    }
                });
                return;
            }

            if (child.getBoundingClientRect().height > 0) {
                blocks.push(child);
            }
        });
    });

    return blocks;
}

async function buildPdfFromBlocks(blocks, attempt) {
    const doc = createPdfDocument();

    for (const block of blocks) {
        const canvas = await html2canvas(block, {
            scale: attempt.scale,
            backgroundColor: '#0c1628',
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: -window.scrollY,
            width: block.scrollWidth || block.offsetWidth,
            height: block.scrollHeight || block.offsetHeight,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        });
        const optimizedCanvas = downscaleCanvas(canvas, attempt.maxWidth);
        addCanvasBlockToPdf(doc, optimizedCanvas, attempt.quality, attempt.compression);
    }

    return doc.pdf;
}

async function createCompressedPdf(targetNode) {
    const exportHeight = targetNode.scrollHeight || targetNode.offsetHeight || 0;
    const blocks = getPrintableBlocks(targetNode);
    if (!blocks.length) {
        return null;
    }
    const attempts = exportHeight > 7000
        ? [
            { scale: 1.18, quality: 0.72, maxWidth: 1700, compression: 'MEDIUM' },
            { scale: 1.04, quality: 0.64, maxWidth: 1500, compression: 'MEDIUM' },
            { scale: 0.92, quality: 0.56, maxWidth: 1320, compression: 'MEDIUM' },
            { scale: 0.82, quality: 0.48, maxWidth: 1160, compression: 'SLOW' },
            { scale: 0.74, quality: 0.4, maxWidth: 1020, compression: 'SLOW' }
        ]
        : [
            { scale: 1.36, quality: 0.78, maxWidth: 2200, compression: 'MEDIUM' },
            { scale: 1.2, quality: 0.7, maxWidth: 1920, compression: 'MEDIUM' },
            { scale: 1.06, quality: 0.62, maxWidth: 1660, compression: 'MEDIUM' },
            { scale: 0.94, quality: 0.54, maxWidth: 1440, compression: 'SLOW' },
            { scale: 0.82, quality: 0.46, maxWidth: 1240, compression: 'SLOW' }
        ];

    let bestUnderMax = null;
    let smallestOverMax = null;

    for (let index = 0; index < attempts.length; index += 1) {
        const pdf = await buildPdfFromBlocks(blocks, attempts[index]);
        const blob = pdf.output('blob');
        const candidate = { pdf, size: blob.size };

        if (blob.size >= PDF_TARGET_MIN_BYTES && blob.size <= PDF_TARGET_MAX_BYTES) {
            return pdf;
        }

        if (blob.size <= PDF_TARGET_MAX_BYTES) {
            if (!bestUnderMax || Math.abs(blob.size - PDF_TARGET_IDEAL_BYTES) < Math.abs(bestUnderMax.size - PDF_TARGET_IDEAL_BYTES)) {
                bestUnderMax = candidate;
            }
            if (blob.size < PDF_TARGET_MIN_BYTES) {
                break;
            }
            continue;
        }

        if (!smallestOverMax || blob.size < smallestOverMax.size) {
            smallestOverMax = candidate;
        }
    }

    return (bestUnderMax || smallestOverMax || {}).pdf || null;
}

async function exportPdfWithFilename(filename) {
    const button = document.getElementById("downloadPdf");
    const printableNode = document.getElementById('printable-content');
    if (!printableNode || !button) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Exporting...";

    try {
        const pdf = await createCompressedPdf(printableNode);
        if (!pdf) {
            throw new Error("PDF generation failed");
        }
        pdf.save(filename);
    } catch (error) {
        alert("Unable to export PDF right now. Please try again.");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

document.getElementById("downloadPdf").addEventListener("click", function() {
    showExportNameModal();
});

if (exportNameConfirm) {
    exportNameConfirm.addEventListener("click", async () => {
        const analystName = analystNameInput ? analystNameInput.value : "";
        const filename = buildExportFilename(analystName);
        try {
            localStorage.setItem(STORAGE_KEYS.analystName, analystName);
        } catch (err) {
            // Ignore storage access errors silently.
        }
        hideExportNameModal();
        await exportPdfWithFilename(filename);
    });
}
