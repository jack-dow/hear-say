import * as React from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  CaretLeft,
  CaretRight,
  Palette,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { AudioQueue } from "@/lib/audioQueue";
import type { Page } from "@/lib/api";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Kokoro voice IDs follow pattern: {accent}{gender}_{name}
// e.g. af_heart = American Female "Heart"
function formatVoiceName(id: string): string {
  const match = id.match(/^([a-z])([mf])_(.+)$/);
  if (!match) return id;
  const [, accent, gender, name] = match;
  const accentLabel = accent === "a" ? "US" : accent === "b" ? "UK" : accent.toUpperCase();
  const genderLabel = gender === "f" ? "♀" : "♂";
  return `${name.charAt(0).toUpperCase() + name.slice(1)} (${accentLabel} ${genderLabel})`;
}

const SWATCHES = [
  { label: "Yellow", value: "#fbbf24" },
  { label: "Green",  value: "#34d399" },
  { label: "Blue",   value: "#60a5fa" },
  { label: "Pink",   value: "#f472b6" },
  { label: "Orange", value: "#fb923c" },
];

interface Props {
  queue: AudioQueue;
  pages: Page[];
  activeSentenceId: string | null;
  voice: string;
  voices: string[];
  autoAdvance: boolean;
  highlightColor: string;
  onSentenceChange: (id: string) => void;
  onAutoAdvanceChange: (v: boolean) => void;
  onHighlightColorChange: (v: string) => void;
  onVoiceChange: (v: string) => void;
}

export function AudioPlayer({
  queue,
  pages,
  activeSentenceId,
  voice,
  voices,
  autoAdvance,
  highlightColor,
  onSentenceChange,
  onAutoAdvanceChange,
  onHighlightColorChange,
  onVoiceChange,
}: Props) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isBuffering, setIsBuffering] = React.useState(false);
  const [speed, setSpeed] = React.useState(1.0);
  const isPlayingRef = React. useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const autoAdvanceRef = React.useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const prevPageRef = React.useRef<number | null>(null);

  // Wire up callbacks once
  React.useEffect(() => {
    queue.onSentenceChange((id) => {
      const newPage = pages.find((p) => p.sentences.some((s) => s.id === id))?.page ?? null;
      if (
        !autoAdvanceRef.current &&
        queue.isPlaying &&
        prevPageRef.current !== null &&
        newPage !== null &&
        newPage !== prevPageRef.current
      ) {
        queue.pause();
        setIsPlaying(false);
      }
      prevPageRef.current = newPage;
      onSentenceChange(id);
    });
    queue.onEnd(() => setIsPlaying(false));
  }, [queue, pages, onSentenceChange]);

  const togglePlay = async () => {
    if (isPlaying) {
      queue.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      setIsBuffering(true);
      await queue.play();
      setIsBuffering(false);
    }
  };

  const handleNext = async () => {
    await queue.next();
  };

  const handlePrev = async () => {
    await queue.prev();
  };

  const handleSpeedChange = (s: number) => {
    setSpeed(s);
    queue.speed = s;
  };

  const handleVoiceChange = (v: string) => {
    queue.voice = v;
    onVoiceChange(v);
  };

  const allSentences = pages.flatMap((p) => p.sentences);
  const currentPage =
    pages.find((p) => p.sentences.some((s) => s.id === activeSentenceId))
      ?.page ?? 1;

  const prevPage = () => {
    const prev = pages.find((p) => p.page === currentPage - 1);
    const first = prev?.sentences[0];
    if (first) queue.seekTo(first.id);
  };

  const nextPage = () => {
    const next = pages.find((p) => p.page === currentPage + 1);
    const first = next?.sentences[0];
    if (first) queue.seekTo(first.id);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlePrev();
          break;
        case "PageDown":
          e.preventDefault();
          nextPage();
          break;
        case "PageUp":
          e.preventDefault();
          prevPage();
          break;
        case "[": {
          const idx = SPEEDS.indexOf(speed);
          if (idx > 0) handleSpeedChange(SPEEDS[idx - 1]);
          break;
        }
        case "]": {
          const idx = SPEEDS.indexOf(speed);
          if (idx < SPEEDS.length - 1) handleSpeedChange(SPEEDS[idx + 1]);
          break;
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className="sticky bottom-0 border-t bg-background">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
        {/* Page nav */}
        <Button
          aria-label="Previous page"
          disabled={currentPage <= 1}
          size="icon-sm"
          variant="ghost"
          onClick={prevPage}
        >
          <CaretLeft weight="thin" />
        </Button>
        <span className="w-16 text-center text-xs text-muted-foreground">
          p. {currentPage}/{pages.length}
        </span>
        <Button
          aria-label="Next page"
          disabled={currentPage >= pages.length}
          size="icon-sm"
          variant="ghost"
          onClick={nextPage}
        >
          <CaretRight weight="thin" />
        </Button>
        <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoAdvance}
            className="accent-primary"
            onChange={(e) => onAutoAdvanceChange(e.target.checked)}
          />
          Auto
        </label>

        <div className="flex-1" />

        {/* Sentence nav + play */}
        <Button
          aria-label="Previous sentence"
          size="icon"
          variant="ghost"
          onClick={handlePrev}
        >
          <SkipBack weight="thin" />
        </Button>
        <Button
          aria-label={isPlaying ? "Pause" : isBuffering ? "Buffering" : "Play"}
          size="icon-lg"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause weight="thin" /> : isBuffering ? <Spinner className="size-4" /> : <Play weight="thin" />}
        </Button>
        <Button
          aria-label="Next sentence"
          size="icon"
          variant="ghost"
          onClick={handleNext}
        >
          <SkipForward weight="thin" />
        </Button>

        <div className="flex-1" />

        {/* Speed selector */}
        <select
          aria-label="Playback speed"
          className={cn(
            "border border-input bg-background px-2 py-1 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring",
          )}
          value={speed}
          onChange={(e) => handleSpeedChange(Number(e.target.value))}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>

        {/* Voice selector */}
        {voices.length > 0 && (
          <select
            aria-label="Voice"
            className={cn(
              "border border-input bg-background px-2 py-1 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring",
            )}
            value={voice}
            onChange={(e) => handleVoiceChange(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v} value={v}>
                {formatVoiceName(v)}
              </option>
            ))}
          </select>
        )}

        {/* Highlight color */}
        <Popover>
          <PopoverTrigger render={
            <Button aria-label="Highlight color" size="icon-sm" variant="ghost">
              <Palette weight="thin" />
            </Button>
          } />
          <PopoverContent side="top" className="w-auto">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium">Highlight color</p>
              <div className="flex gap-2">
                {SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    aria-label={s.label}
                    className="size-6 border-2 transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: s.value,
                      borderColor: highlightColor === s.value ? s.value : "transparent",
                    }}
                    onClick={() => onHighlightColorChange(s.value)}
                  />
                ))}
              </div>
              <input
                type="color"
                value={highlightColor}
                className="h-7 w-full cursor-pointer border"
                onChange={(e) => onHighlightColorChange(e.target.value)}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
