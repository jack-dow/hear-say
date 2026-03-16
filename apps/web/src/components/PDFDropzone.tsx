import * as React from "react";
import { useDropzone } from "react-dropzone";
import { BarLoader } from "@/components/ui/bar-loader";

interface Props {
  onFile: (file: File) => Promise<void>;
  onError: (msg: string) => void;
}

export function PDFDropzone({ onFile, onError }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        onError("Only PDF files are supported.");
        return;
      }
      setPendingFile(file);
      setLoading(true);
      try {
        await onFile(file);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Upload failed");
        setPendingFile(null);
      } finally {
        setLoading(false);
      }
    },
    [onFile, onError],
  );

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    accept: { "application/pdf": [".pdf"] },
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        onError("Only PDF files are supported.");
        return;
      }
      if (accepted[0]) handleFile(accepted[0]);
    },
  });

  return (
    <div className="w-full" {...getRootProps()}>
      <div
        onClick={() => !loading && fileInputRef.current?.click()}
        className={`w-full cursor-pointer border-2 border-dashed p-10 transition-colors ${
          isDragActive ? "border-foreground bg-accent" : "border-border hover:border-foreground"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          aria-label="Upload PDF"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <BarLoader className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Processing PDF…</p>
          </div>
        ) : pendingFile ? (
          <div className="border border-foreground p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="truncate text-sm">{pendingFile.name}</p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {(pendingFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{pendingFile.type}</span>
              <span>modified {new Date(pendingFile.lastModified).toLocaleDateString()}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium">
              {isDragActive ? "Drop PDF here" : "Upload PDF"}
            </p>
            <p className="text-xs text-muted-foreground">Drag and drop or click to browse</p>
          </div>
        )}
      </div>
    </div>
  );
}
