import * as React from "react";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  isReady: boolean;
  progress: { loaded: number; total: number } | null;
}

export function ModelLoader({ isReady, progress }: Props) {
  if (isReady) return null;

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.loaded / progress.total) * 100)
      : null;

  const loadedMB = progress ? (progress.loaded / 1024 / 1024).toFixed(0) : null;
  const totalMB = progress ? (progress.total / 1024 / 1024).toFixed(0) : null;

  return (
    <div className="sticky bottom-0 border-t bg-background/95 px-6 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Spinner className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {percent !== null
              ? `Loading voice model… ${loadedMB}MB / ${totalMB}MB`
              : "Loading voice model…"}
          </p>
          {percent !== null && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
