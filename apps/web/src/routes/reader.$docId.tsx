import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, Bookmark, Columns, DownloadSimple, FileText, File, Sparkle, LinkSimple } from "@phosphor-icons/react";
import { useQuery, useMutation } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PageView } from "@/components/PageView";
import { PdfViewer } from "@/components/PdfViewer";
import type { SentenceOverlay } from "@/components/PdfViewer";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ModelLoader } from "@/components/ModelLoader";
import { BarLoader } from "@/components/ui/bar-loader";
import { ProcessingSteps } from "@/components/ProcessingSteps";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "motion/react";
import { AudioQueue } from "@/lib/audioQueue";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InlineEdit } from "@/components/InlineEdit";
import { retryUpload, llmCleanDocument } from "@/lib/api";
import { useReaderPrefs } from "@/hooks/useReaderPrefs";
import { AnnotationPopover } from "@/components/AnnotationPopover";
import { AnnotationsPanel } from "@/components/AnnotationsPanel";
import { Tooltip, TooltipTrigger, TooltipPopup } from "@/components/ui/tooltip";
import { api } from "@hearsay/convex/api";

type ViewMode = "text" | "pdf" | "split";

function PdfAreaSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col items-center gap-4 overflow-y-auto px-4 py-6"
    >
      {[1.414, 1.414, 1.1].map((ratio, i) => (
        <Skeleton
          key={i}
          className="w-full max-w-2xl shrink-0 rounded-none"
          style={{ aspectRatio: `1 / ${ratio}` }}
        />
      ))}
    </motion.div>
  );
}

export const Route = createFileRoute("/reader/$docId")({
  component: Reader,
  validateSearch: (search: Record<string, unknown>) => ({
    view: (["text", "pdf", "split"].includes(search.view as string)
      ? (search.view as ViewMode)
      : "text") satisfies ViewMode,
  }),
});

function Reader() {
  const { docId } = Route.useParams();
  const doc = useQuery(api.documents.getDocument, { docId });
  const savedPosition = useQuery(api.documents.getPosition, { docId });
  const savePosition = useMutation(api.documents.savePosition);
  const renameDocument = useMutation(api.documents.renameDocument);
  const token = useAuthToken();

  const [voices, setVoices] = React.useState<string[]>([]);
  const [modelReady, setModelReady] = React.useState(false);
  const [modelProgress, setModelProgress] = React.useState<{ loaded: number; total: number } | null>(null);
  const [activeSentenceId, setActiveSentenceId] = React.useState<string | null>(null);
  const [syncScroll, setSyncScroll] = React.useState(true);
  const { view: viewMode } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { autoAdvance, setAutoAdvance, highlightColor, setHighlightColor, voice, setVoice } = useReaderPrefs();
  const annotations = useQuery(api.annotations.listAnnotations, { docId }) ?? [];
  const [annotatingId, setAnnotatingId] = React.useState<string | null>(null);
  const [annotatingAnchor, setAnnotatingAnchor] = React.useState<Element | null>(null);
  const [annotationsPanelOpen, setAnnotationsPanelOpen] = React.useState(false);

  const pdfUrl = useQuery(
    api.documents.getPdfUrl,
    viewMode === "text" ? "skip" : { docId },
  );

  const queue = React.useMemo(() => new AudioQueue(), []);
  const initialized = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfScrollRef = React.useRef<HTMLDivElement>(null);
  const textScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollLock = React.useRef<"pdf" | "text" | null>(null);
  const scrollLockTimeout = React.useRef<ReturnType<typeof setTimeout>>();

  const pages = doc?.pages ?? [];

  const activeSentence = React.useMemo(() => {
    if (!activeSentenceId) return null;
    for (const page of pages) {
      const sentence = page.sentences.find((s) => s.id === activeSentenceId);
      if (sentence) return { ...sentence, page: page.page };
    }
    return null;
  }, [activeSentenceId, pages]);

  // Wire AudioQueue callbacks for model loading + voices
  React.useEffect(() => {
    queue.onVoicesChanged = (v) => setVoices(Array.isArray(v) ? v : []);
    queue.onModelReady = () => setModelReady(true);
    queue.onModelProgress = (loaded, total) => setModelProgress({ loaded, total });
  }, [queue]);

  // Initialize queue when doc + position both resolve
  React.useEffect(() => {
    if (
      !doc ||
      doc.status !== "ready" ||
      savedPosition === undefined ||
      initialized.current
    )
      return;
    initialized.current = true;

    if (!doc.llmCleaned) {
      console.warn("[reader] LLM cleaning was not applied to this document — citations and OCR artifacts may be read aloud");
    }

    const allSentences = doc.pages?.flatMap((p) => p.sentences) ?? [];
    const startId = savedPosition?.sentenceId ?? undefined;
    queue.voice = voice;
    queue.load(allSentences, startId);
    setActiveSentenceId(startId ?? allSentences[0]?.id ?? null);
  }, [doc, savedPosition, queue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist position (debounced)
  React.useEffect(() => {
    if (!activeSentenceId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePosition({ docId, sentenceId: activeSentenceId });
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [docId, activeSentenceId, savePosition]);

  // Cleanup on unmount
  React.useEffect(() => () => queue.destroy(), [queue]);

  // Scroll sync in split mode
  React.useEffect(() => {
    if (viewMode !== "split" || !syncScroll) return;
    const pdfEl = pdfScrollRef.current;
    const textEl = textScrollRef.current;
    if (!pdfEl || !textEl) return;

    function getVisiblePage(container: HTMLDivElement): number | null {
      const containerRect = container.getBoundingClientRect();
      let bestPage: number | null = null;
      let bestOverlap = 0;
      for (const el of container.querySelectorAll<HTMLElement>("[data-page]")) {
        const rect = el.getBoundingClientRect();
        const overlap = Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top);
        if (overlap > bestOverlap) { bestOverlap = overlap; bestPage = Number(el.dataset.page); }
      }
      return bestPage;
    }

    function handlePdfScroll() {
      if (scrollLock.current === "text") return;
      scrollLock.current = "pdf";
      clearTimeout(scrollLockTimeout.current);
      const page = getVisiblePage(pdfEl!);
      if (page) textEl!.querySelector<HTMLElement>(`[data-page="${page}"]`)?.scrollIntoView({ behavior: "instant", block: "start" });
      scrollLockTimeout.current = setTimeout(() => { scrollLock.current = null; }, 150);
    }

    function handleTextScroll() {
      if (scrollLock.current === "pdf") return;
      scrollLock.current = "text";
      clearTimeout(scrollLockTimeout.current);
      const page = getVisiblePage(textEl!);
      if (page) pdfEl!.querySelector<HTMLElement>(`[data-page="${page}"]`)?.scrollIntoView({ behavior: "instant", block: "start" });
      scrollLockTimeout.current = setTimeout(() => { scrollLock.current = null; }, 150);
    }

    pdfEl.addEventListener("scroll", handlePdfScroll);
    textEl.addEventListener("scroll", handleTextScroll);
    return () => {
      pdfEl.removeEventListener("scroll", handlePdfScroll);
      textEl.removeEventListener("scroll", handleTextScroll);
    };
  }, [viewMode, syncScroll]);

  // Build sentenceId → text lookup for annotations panel
  const sentenceTextMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const page of pages) {
      for (const s of page.sentences) map.set(s.id, s.text);
    }
    return map;
  }, [pages]);

  // Build annotation overlays per page for PdfViewer
  const sentenceOverlays = React.useMemo(() => {
    const annMap = new Map<string, { highlight?: (typeof annotations)[0]; bookmark?: (typeof annotations)[0] }>();
    for (const ann of annotations) {
      const entry = annMap.get(ann.sentenceId) ?? {};
      if (ann.type === "highlight") entry.highlight = ann;
      else entry.bookmark = ann;
      annMap.set(ann.sentenceId, entry);
    }

    const map = new Map<number, SentenceOverlay[]>();
    for (const page of pages) {
      const overlays: SentenceOverlay[] = [];
      for (const s of page.sentences) {
        if (!s.bbox) continue;
        const entry = annMap.get(s.id);
        overlays.push({ id: s.id, bbox: s.bbox, highlightColor: entry?.highlight?.color, isBookmarked: !!entry?.bookmark });
      }
      if (overlays.length > 0) map.set(page.page, overlays);
    }
    return map;
  }, [pages, annotations]);

  const handleAnnotate = (sentenceId: string, el: Element) => {
    if (annotatingId === sentenceId) {
      setAnnotatingId(null);
      setAnnotatingAnchor(null);
    } else {
      setAnnotatingId(sentenceId);
      setAnnotatingAnchor(el);
    }
  };

  const exportText = () => {
    if (!doc?.pages) return;
    const text = doc.pages.map((p) => p.text).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.filename.replace(/\.pdf$/i, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // doc === undefined: still loading
  // doc === null: not found / no access
  if (doc === undefined || savedPosition === undefined) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex h-screen flex-col overflow-hidden"
      >
        {/* Header skeleton */}
        <div className="flex items-center gap-3 border-b bg-background px-6 py-3">
          <Skeleton className="size-7 shrink-0" />
          <Skeleton className="h-4 w-48" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 overflow-hidden px-8 py-8 max-w-3xl mx-auto w-full">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[97%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[60%]" />
            <div className="h-3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[94%]" />
            <Skeleton className="h-4 w-[75%]" />
            <div className="h-3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[91%]" />
            <Skeleton className="h-4 w-[50%]" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (doc === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Document not found.</p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft weight="thin" /> Back
          </Button>
        </Link>
      </main>
    );
  }

  if (doc.status === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Failed to process document.</p>
        {doc.errorMessage && (
          <pre className="max-w-lg overflow-auto bg-muted px-4 py-2 text-xs text-destructive">
            {doc.errorMessage}
          </pre>
        )}
        <div className="flex gap-2">
          <Button onClick={() => token && retryUpload(doc._id, token)}>
            Retry
          </Button>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft weight="thin" /> Back
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (doc.status === "processing") {
    const isRetrying = (doc.retryCount ?? 0) > 0;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-6">
          <p className="text-xs font-medium tracking-widest text-muted-foreground/60 uppercase">
            Processing
          </p>
          <ProcessingSteps
            currentStep={doc.processingStep}
            isRetrying={isRetrying}
            retryCount={doc.retryCount}
          />
        </div>
        {isRetrying && doc.errorMessage && (
          <pre className="max-w-lg overflow-auto rounded bg-muted px-4 py-2 text-xs text-muted-foreground">
            Last error: {doc.errorMessage}
          </pre>
        )}
        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
        <Link to="/">
          <Button aria-label="Back" size="icon-sm" variant="ghost">
            <ArrowLeft weight="thin" />
          </Button>
        </Link>
        <InlineEdit
          value={doc.displayName ?? doc.filename}
          onSave={(name) => renameDocument({ documentId: doc._id, displayName: name })}
          className="text-sm font-medium"
        />
        {doc.llmCleaned ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Sparkle weight="thin" className="size-4 shrink-0 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipPopup>AI-cleaned for TTS</TooltipPopup>
          </Tooltip>
        ) : token ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Clean with AI"
                size="icon-sm"
                variant="ghost"
                onClick={() => { initialized.current = false; llmCleanDocument(doc._id, token); }}
              >
                <Sparkle weight="thin" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipPopup>Clean with AI</TooltipPopup>
          </Tooltip>
        ) : null}
        {/* View mode toggle */}
        <div className="flex items-center border p-0.5">
          {(
            [
              { mode: "text", icon: <FileText weight="thin" />, label: "Text" },
              { mode: "pdf", icon: <File weight="thin" />, label: "PDF" },
              { mode: "split", icon: <Columns weight="thin" />, label: "Side by side" },
            ] as { mode: ViewMode; icon: React.ReactNode; label: string }[]
          ).map(({ mode, icon, label }) => (
            <Button
              key={mode}
              aria-label={label}
              aria-pressed={viewMode === mode}
              size="icon-sm"
              variant={viewMode === mode ? "secondary" : "ghost"}
              onClick={() => navigate({ search: (prev) => ({ ...prev, view: mode }) })}
            >
              {icon}
            </Button>
          ))}
        </div>
        {viewMode === "split" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={syncScroll ? "Disable scroll sync" : "Enable scroll sync"}
                aria-pressed={syncScroll}
                size="icon-sm"
                variant={syncScroll ? "secondary" : "ghost"}
                onClick={() => setSyncScroll((v) => !v)}
              >
                <LinkSimple weight="thin" />
              </Button>
            </TooltipTrigger>
            <TooltipPopup>{syncScroll ? "Scroll sync on" : "Scroll sync off"}</TooltipPopup>
          </Tooltip>
        )}
        <ThemeToggle />
        <Button
          aria-label="Export as text"
          size="icon-sm"
          variant="ghost"
          onClick={exportText}
        >
          <DownloadSimple weight="thin" />
        </Button>
        <Button
          aria-label="Annotations"
          size="icon-sm"
          variant={annotationsPanelOpen ? "secondary" : "ghost"}
          onClick={() => setAnnotationsPanelOpen((o) => !o)}
          className="relative"
        >
          <Bookmark weight="thin" />
          {annotations.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {annotations.length > 9 ? "9+" : annotations.length}
            </span>
          )}
        </Button>
      </header>

      {/* Annotations popover (anchored to clicked sentence overlay) */}
      <AnnotationPopover
        open={!!annotatingId}
        anchor={annotatingAnchor}
        sentenceId={annotatingId}
        docId={docId}
        existingBookmark={annotations.find((a) => a.type === "bookmark" && a.sentenceId === annotatingId)}
        existingHighlight={annotations.find((a) => a.type === "highlight" && a.sentenceId === annotatingId)}
        onClose={() => { setAnnotatingId(null); setAnnotatingAnchor(null); }}
      />

      {/* Annotations side panel */}
      <AnnotationsPanel
        open={annotationsPanelOpen}
        onOpenChange={setAnnotationsPanelOpen}
        annotations={annotations}
        sentenceTextMap={sentenceTextMap}
        docFilename={doc.filename}
        onJumpTo={(id) => { queue.seekTo(id); setActiveSentenceId(id); setAnnotationsPanelOpen(false); }}
      />

      {/* Content */}
      {viewMode === "split" ? (
        <div className="flex flex-1 overflow-hidden">
          <div ref={pdfScrollRef} className="h-full w-1/2 overflow-y-auto border-r">
            {pdfUrl ? <PdfViewer url={pdfUrl} activePage={activeSentence?.page} activeBbox={activeSentence?.bbox} sentenceOverlays={sentenceOverlays} onAnnotate={handleAnnotate} /> : <PdfAreaSkeleton />}
          </div>
          <div ref={textScrollRef} className="h-full w-1/2 overflow-y-auto">
            <PageView
              activeSentenceId={activeSentenceId}
              pages={pages}
              onSentenceClick={(id) => {
                queue.seekTo(id);
                setActiveSentenceId(id);
              }}
            />
          </div>
        </div>
      ) : viewMode === "pdf" ? (
        <div className="flex-1 overflow-y-auto">
          {pdfUrl ? <PdfViewer url={pdfUrl} activePage={activeSentence?.page} activeBbox={activeSentence?.bbox} sentenceOverlays={sentenceOverlays} onAnnotate={handleAnnotate} /> : <PdfAreaSkeleton />}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <PageView
            activeSentenceId={activeSentenceId}
            pages={pages}
            onSentenceClick={(id) => {
              queue.seekTo(id);
              setActiveSentenceId(id);
            }}
          />
        </div>
      )}

      {/* Audio controls */}
      {modelReady ? (
        <AudioPlayer
          activeSentenceId={activeSentenceId}
          autoAdvance={autoAdvance}
          highlightColor={highlightColor}
          pages={pages}
          queue={queue}
          voice={voice}
          voices={voices}
          onAutoAdvanceChange={setAutoAdvance}
          onHighlightColorChange={setHighlightColor}
          onSentenceChange={(id) => setActiveSentenceId(id)}
          onVoiceChange={setVoice}
        />
      ) : (
        <ModelLoader isReady={modelReady} progress={modelProgress} />
      )}
    </div>
  );
}
