import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import type { Page } from "@/lib/api";
import { Tooltip, TooltipTrigger, TooltipPopup } from "@/components/ui/tooltip";

interface Props {
  pages: Page[];
  activeSentenceId: string | null;
  onSentenceClick: (id: string) => void;
}

export function PageView({ pages, activeSentenceId, onSentenceClick }: Props) {
  const activeRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSentenceId]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      {pages.map((page) => {
        const paragraphs = groupByParagraph(page);
        return (
          <section key={page.page} data-page={page.page}>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Page {page.page}
            </p>
            <div className="space-y-4 text-base leading-relaxed">
              {paragraphs.map((sentences, pIdx) => (
                <div key={pIdx}>
                  {sentences.map((s) => {
                    const trivial = isTrivial(s.text);
                    const removedTokens = s.rawText ? getRemovedTokens(s.rawText, s.text) : [];
                    const span = (
                      <span
                        ref={activeSentenceId === s.id ? activeRef : null}
                        id={s.id}
                        className={cn(
                          "cursor-pointer rounded px-0.5 transition-colors",
                          trivial
                            ? "opacity-40"
                            : activeSentenceId === s.id
                              ? "text-foreground"
                              : "hover:bg-muted",
                        )}
                        style={
                          activeSentenceId === s.id
                            ? { backgroundColor: "color-mix(in srgb, var(--highlight-color) 35%, transparent)" }
                            : undefined
                        }
                        onClick={() => onSentenceClick(s.id)}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{ p: ({ children }) => <>{children}</> }}
                        >
                          {s.text}
                        </ReactMarkdown>
                        {removedTokens.length > 0 && (
                          <del className="ml-1 opacity-25 text-sm" aria-hidden="true">
                            {removedTokens.join(" ")}
                          </del>
                        )}{" "}
                      </span>
                    );
                    return trivial ? (
                      <Tooltip key={s.id} >
                        <TooltipTrigger render={() => span}/>
                        <TooltipPopup>TTS will skip — too short to read</TooltipPopup>
                      </Tooltip>
                    ) : (
                      <React.Fragment key={s.id}>{span}</React.Fragment>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function isTrivial(text: string) {
  return text.trim().length < 3;
}

/** Returns tokens present in `raw` but removed in `clean` (word-level forward scan). */
function getRemovedTokens(raw: string, clean: string): string[] {
  const rawTokens = raw.split(/\s+/).filter(Boolean);
  const cleanTokens = clean.split(/\s+/).filter(Boolean);
  const removed: string[] = [];
  let ci = 0;
  for (const token of rawTokens) {
    if (ci < cleanTokens.length && cleanTokens[ci] === token) {
      ci++;
    } else {
      removed.push(token);
    }
  }
  return removed;
}

function groupByParagraph(page: Page) {
  const map = new Map<number, typeof page.sentences>();
  for (const s of page.sentences) {
    const group = map.get(s.paragraph) ?? [];
    group.push(s);
    map.set(s.paragraph, group);
  }
  return Array.from(map.values());
}
