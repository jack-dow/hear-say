import * as React from "react";
import { Star } from "@phosphor-icons/react";
import pdfWorkerUrl from "react-pdf/dist/pdf.worker.entry.js?url"
import { motion, AnimatePresence } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";

interface Bbox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SentenceOverlay {
  id: string;
  bbox: Bbox;
  highlightColor?: string;
  isBookmarked?: boolean;
}

interface Props {
  url: string;
  activePage?: number;
  activeBbox?: Bbox;
  sentenceOverlays?: Map<number, SentenceOverlay[]>;
  onAnnotate?: (sentenceId: string, el: Element) => void;
}

type ReactPdfModule = typeof import("react-pdf");

function PageSkeleton({ width }: { width: number }) {
  return (
    <Skeleton
      className="mx-auto mb-4 rounded-none"
      style={{ width: width || "100%", height: width ? Math.round(width * 1.414) : 500 }}
    />
  );
}

export function PdfViewer({ url, activePage, activeBbox, sentenceOverlays, onAnnotate }: Props) {
  const [pdfLib, setPdfLib] = React.useState<ReactPdfModule | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [pageWidth, setPageWidth] = React.useState(0);
  const [pdfLoading, setPdfLoading] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activePageRef = React.useRef<HTMLDivElement>(null);

  // Dynamic import — never runs during SSR, avoids DOMMatrix error in Node.js
  React.useEffect(() => {
    import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      setPdfLib(mod);
    });
  }, []);

  // Measure container width for responsive page rendering
  React.useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setPageWidth(entry.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Auto-scroll to active page
  React.useEffect(() => {
    activePageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activePage]);

  const { Document, Page } = pdfLib ?? {};
  const showSkeleton = !Document || !Page || pdfLoading;

  return (
    <div ref={containerRef} className="h-full w-full">
      <AnimatePresence initial={false}>
        {showSkeleton && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col py-4"
          >
            {[1, 2, 3].map((i) => (
              <PageSkeleton key={i} width={pageWidth} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {Document && Page && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: pdfLoading ? 0 : 1 }}
          transition={{ duration: 0.25 }}
        >
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPdfLoading(false); }}
        >
          {Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1;
            const isActive = pageNum === activePage;
            const overlays = sentenceOverlays?.get(pageNum);
            return (
              <div
                key={pageNum}
                ref={isActive ? activePageRef : null}
                data-page={pageNum}
                className="relative mx-auto mb-4"
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth || undefined}
                  renderTextLayer={false}
                  loading={<PageSkeleton width={pageWidth} />}
                />
                {/* Active sentence highlight */}
                {isActive && activeBbox && (
                  <div
                    className="pointer-events-none absolute rounded bg-yellow-300/40 ring-1 ring-yellow-400/60"
                    style={{
                      left: `${activeBbox.x1 * 100}%`,
                      top: `${activeBbox.y1 * 100}%`,
                      width: `${(activeBbox.x2 - activeBbox.x1) * 100}%`,
                      height: `${(activeBbox.y2 - activeBbox.y1) * 100}%`,
                    }}
                  />
                )}
                {/* Annotation overlays */}
                {overlays?.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="group absolute cursor-pointer rounded transition-opacity"
                    style={{
                      left: `${overlay.bbox.x1 * 100}%`,
                      top: `${overlay.bbox.y1 * 100}%`,
                      width: `${(overlay.bbox.x2 - overlay.bbox.x1) * 100}%`,
                      height: `${(overlay.bbox.y2 - overlay.bbox.y1) * 100}%`,
                      backgroundColor: overlay.highlightColor
                        ? `${overlay.highlightColor}66`
                        : undefined,
                      outline: overlay.highlightColor
                        ? `1px solid ${overlay.highlightColor}99`
                        : overlay.isBookmarked
                          ? "1px solid rgb(251 191 36 / 0.5)"
                          : "1px solid transparent",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnnotate?.(overlay.id, e.currentTarget);
                    }}
                  >
                    {/* Hover hint for unannotated sentences */}
                    {!overlay.highlightColor && !overlay.isBookmarked && (
                      <div className="absolute inset-0 rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/8 hover:outline hover:outline-primary/20" />
                    )}
                    {/* Bookmark star indicator */}
                    {overlay.isBookmarked && (
                      <Star weight="fill" className="absolute -right-1.5 -top-2 size-3 text-amber-400 drop-shadow-sm" />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </Document>
        </motion.div>
      )}
    </div>
  );
}
