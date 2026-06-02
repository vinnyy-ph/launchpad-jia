"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import styles from "@/lib/styles/components/stage-attachments.module.scss";

// Configure PDF.js worker for react-pdf v10+ with Next.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoadError(false);
  }

  function onDocumentLoadError() {
    setLoadError(true);
  }

  function goToPrevPage() {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }

  function goToNextPage() {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  }

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }

  if (loadError) {
    return (
      <div className={styles.viewerPdfFallback}>
        <i className="la la-file-pdf" />
        <span>Failed to load PDF</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.openPdfButton}
        >
          <i className="la la-external-link-alt" />
          Open PDF in new tab
        </a>
      </div>
    );
  }

  return (
    <div className={styles.viewerPdfPreview}>
      <div className={styles.pdfDocumentContainer}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className={styles.pdfLoading}>
              <i className="la la-spinner la-spin" />
              <span>Loading PDF...</span>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {numPages && (
        <div className={styles.pdfControls}>
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className={styles.pdfControlButton}
            title="Previous page"
          >
            <i className="la la-chevron-left" />
          </button>
          <span className={styles.pdfPageInfo}>
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className={styles.pdfControlButton}
            title="Next page"
          >
            <i className="la la-chevron-right" />
          </button>
          <div className={styles.pdfControlsDivider} />
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className={styles.pdfControlButton}
            title="Zoom out"
          >
            <i className="la la-minus" />
          </button>
          <span className={styles.pdfZoomInfo}>{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className={styles.pdfControlButton}
            title="Zoom in"
          >
            <i className="la la-plus" />
          </button>
        </div>
      )}
    </div>
  );
}

