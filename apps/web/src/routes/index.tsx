import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { FileText, SignOut, Sparkle, Tag, Trash } from "@phosphor-icons/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexHttpClient } from "convex/browser";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { PDFDropzone } from "@/components/PDFDropzone";
import { InlineEdit } from "@/components/InlineEdit";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui/spinner";
import { BarLoader } from "@/components/ui/bar-loader";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/TagBadge";
import { TagFilterBar } from "@/components/TagFilterBar";
import { TagPicker } from "@/components/TagPicker";
import { toastManager } from "@/components/ui/toast";
import { computeSha256, llmCleanDocument, uploadDocument } from "@/lib/api";
import { env } from "@/lib/env";
import { api } from "@hearsay/convex/api";
import type { Doc } from "@hearsay/convex/dataModel";

const loader = async () => {
  if (typeof window === "undefined") return { recentDocs: undefined, allTags: undefined };
  const namespace = env.VITE_CONVEX_URL.replace(/[^a-zA-Z0-9]/g, "");
  const token = localStorage.getItem(`__convexAuthJWT_${namespace}`);
  if (!token) return { recentDocs: undefined, allTags: undefined };

  const client = new ConvexHttpClient(env.VITE_CONVEX_URL);
  client.setAuth(token);

  const [recentDocs, allTags] = await Promise.all([
    client.query(api.documents.listDocuments, {}),
    client.query(api.tags.listTags, {}),
  ]).catch(() => [undefined, undefined]);

  return { recentDocs, allTags };
};

export const Route = createFileRoute("/")({
  loader,
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const token = useAuthToken();
  const { recentDocs: preloadedDocs, allTags: preloadedTags } = Route.useLoaderData();
  const recentDocs = useQuery(api.documents.listDocuments) ?? preloadedDocs;
  const allTags = useQuery(api.tags.listTags) ?? preloadedTags;
  const deleteDocument = useMutation(api.documents.deleteDocument);
  const renameDocument = useMutation(api.documents.renameDocument);
  const [editingDoc, setEditingDoc] = React.useState<Doc<"documents"> | null>(null);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!token) throw new Error("Not authenticated");
      const docId = await computeSha256(file);
      await uploadDocument(file, docId, token);
      navigate({ to: "/reader/$docId", params: { docId } });
    },
    [token, navigate],
  );

  const onError = React.useCallback((msg: string) => {
    toastManager.add({ title: "Error", description: msg, type: "error" });
  }, []);

  const tagMap = React.useMemo(() => {
    const m = new Map<string, Doc<"tags">>();
    allTags?.forEach((t) => m.set(t._id, t));
    return m;
  }, [allTags]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <img src="/static/images/logo.png" alt="HearSay" className="h-16 w-auto" />
          <p className="text-muted-foreground">
            Upload a PDF to read it aloud with sentence-by-sentence highlighting.
          </p>
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          onClick={() => signOut()}
        >
          <SignOut weight="thin" />
        </Button>
      </div>

      <PDFDropzone onFile={handleFile} onError={onError} />

      {recentDocs && recentDocs.length > 0 && (
        <section className="space-y-3">
          {allTags && allTags.length > 0 && <TagFilterBar tags={allTags} />}

          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Recent
          </h2>

          <ul className="space-y-1">
            {recentDocs.map((doc) => (
              <li key={doc._id} className="group flex items-center gap-1">
                <Link
                  className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  params={{ docId: doc.docId }}
                  to="/reader/$docId"
                >
                  <FileText weight="thin" className="size-4 shrink-0 text-muted-foreground" />
                  <InlineEdit
                    value={doc.displayName ?? doc.filename}
                    onSave={(name) => renameDocument({ documentId: doc._id, displayName: name })}
                    className="text-sm"
                  />
                  {doc.tagIds && doc.tagIds.length > 0 && (
                    <span className="flex shrink-0 items-center gap-1">
                      {doc.tagIds.map((tid) => {
                        const t = tagMap.get(tid);
                        return t ? <TagBadge key={tid} tag={t} /> : null;
                      })}
                    </span>
                  )}
                  {doc.status === "processing" && (
                    <BarLoader className="size-3 text-muted-foreground" />
                  )}
                  {doc.status === "processing" && (
                    <span className="text-xs text-muted-foreground">
                      {doc.retryCount && doc.retryCount > 0
                        ? `Retry ${doc.retryCount}`
                        : ({ converting: "Extracting", ocr: "OCR", cleaning: "Cleaning" }[doc.processingStep ?? ""] ?? "Uploading")}
                    </span>
                  )}
                </Link>
                {doc.status === "ready" && !doc.llmCleaned && token && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clean with AI"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => llmCleanDocument(doc._id, token)}
                  >
                    <Sparkle weight="thin" className="size-4 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Manage folders"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => setEditingDoc(doc)}
                >
                  <Tag weight="thin" className="size-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete document"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    if (confirm(`Delete "${doc.filename}"?`)) {
                      deleteDocument({ documentId: doc._id });
                    }
                  }}
                >
                  <Trash weight="thin" className="size-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editingDoc && allTags && (
        <TagPicker
          doc={editingDoc}
          tags={allTags}
          onClose={() => setEditingDoc(null)}
        />
      )}
    </main>
  );
}
