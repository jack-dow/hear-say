import { BookmarkIcon, DownloadSimpleIcon, HighlighterIcon, NavigationArrowIcon, TrashIcon } from '@phosphor-icons/react'
import { useMutation } from 'convex/react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetPanel, SheetTitle } from '@/components/ui/sheet'
import { api } from '@hearsay/convex/api'
import type { Id } from '@hearsay/convex/dataModel'

type Annotation = {
	_id: string
	type: 'bookmark' | 'highlight'
	sentenceId: string
	note?: string
	color?: string
}

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	annotations: Annotation[]
	sentenceTextMap: Map<string, string>
	docFilename: string
	onJumpTo: (sentenceId: string) => void
}

export function AnnotationsPanel({ open, onOpenChange, annotations, sentenceTextMap, docFilename, onJumpTo }: Props) {
	const removeAnnotation = useMutation(api.annotations.removeAnnotation)
	const updateNote = useMutation(api.annotations.updateAnnotationNote)

	const bookmarks = annotations.filter((a) => a.type === 'bookmark')
	const highlights = annotations.filter((a) => a.type === 'highlight')

	const exportMarkdown = () => {
		const lines: string[] = [`# Annotations — ${docFilename}\n`]

		if (bookmarks.length > 0) {
			lines.push('## Bookmarks\n')
			for (const b of bookmarks) {
				const text = sentenceTextMap.get(b.sentenceId) ?? b.sentenceId
				lines.push(`> ${text}\n`)
				if (b.note) lines.push(`${b.note}\n`)
				lines.push('')
			}
		}

		if (highlights.length > 0) {
			lines.push('## Highlights\n')
			for (const h of highlights) {
				const text = sentenceTextMap.get(h.sentenceId) ?? h.sentenceId
				lines.push(`> ${text}\n`)
				lines.push('')
			}
		}

		const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${docFilename.replace(/\.pdf$/i, '')}-annotations.md`
		a.click()
		URL.revokeObjectURL(url)
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right">
				<SheetHeader>
					<div className="flex items-center justify-between pr-8">
						<SheetTitle>
							Annotations{' '}
							{annotations.length > 0 && (
								<span className="text-muted-foreground ml-1 text-sm font-normal">({annotations.length})</span>
							)}
						</SheetTitle>
						{annotations.length > 0 && (
							<Button size="icon-sm" variant="ghost" onClick={exportMarkdown} aria-label="Export">
								<DownloadSimpleIcon weight="thin" />
							</Button>
						)}
					</div>
				</SheetHeader>
				<SheetPanel>
					{annotations.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No annotations yet. Click a sentence in PDF view to highlight or bookmark it.
						</p>
					) : (
						<div className="flex flex-col gap-6">
							{bookmarks.length > 0 && (
								<section>
									<div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
										<BookmarkIcon weight="thin" className="size-3" />
										Bookmarks
									</div>
									<ul className="flex flex-col gap-2">
										{bookmarks.map((b) => (
											<AnnotationItem
												key={b._id}
												annotation={b}
												text={sentenceTextMap.get(b.sentenceId) ?? ''}
												onJumpTo={() => onJumpTo(b.sentenceId)}
												onRemove={() => removeAnnotation({ annotationId: b._id as Id<'annotations'> })}
												onNoteChange={(note) => updateNote({ annotationId: b._id as Id<'annotations'>, note })}
											/>
										))}
									</ul>
								</section>
							)}

							{highlights.length > 0 && (
								<section>
									<div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
										<HighlighterIcon weight="thin" className="size-3" />
										Highlights
									</div>
									<ul className="flex flex-col gap-2">
										{highlights.map((h) => (
											<AnnotationItem
												key={h._id}
												annotation={h}
												text={sentenceTextMap.get(h.sentenceId) ?? ''}
												onJumpTo={() => onJumpTo(h.sentenceId)}
												onRemove={() => removeAnnotation({ annotationId: h._id as Id<'annotations'> })}
											/>
										))}
									</ul>
								</section>
							)}
						</div>
					)}
				</SheetPanel>
			</SheetContent>
		</Sheet>
	)
}

function AnnotationItem({
	annotation,
	text,
	onJumpTo,
	onRemove,
	onNoteChange,
}: {
	annotation: Annotation
	text: string
	onJumpTo: () => void
	onRemove: () => void
	onNoteChange?: (note: string) => void
}) {
	const [note, setNote] = React.useState(annotation.note ?? '')
	const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

	const handleNoteChange = (value: string) => {
		setNote(value)
		if (timer.current) clearTimeout(timer.current)
		timer.current = setTimeout(() => onNoteChange?.(value), 600)
	}

	return (
		<li className="group bg-muted/40 flex flex-col gap-1 rounded-md border p-2.5">
			<div className="flex items-start gap-1">
				{annotation.color && (
					<span className="mt-0.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: annotation.color }} />
				)}
				<p className="text-foreground line-clamp-3 flex-1 text-xs leading-relaxed">{text || annotation.sentenceId}</p>
				<div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
					<Button size="icon-sm" variant="ghost" aria-label="Jump to" onClick={onJumpTo} className="size-6">
						<NavigationArrowIcon weight="thin" className="size-3" />
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label="Remove"
						onClick={onRemove}
						className="text-destructive hover:text-destructive size-6"
					>
						<TrashIcon weight="thin" className="size-3" />
					</Button>
				</div>
			</div>
			{annotation.type === 'bookmark' && onNoteChange && (
				<textarea
					className="text-foreground placeholder:text-muted-foreground focus:ring-ring min-h-12 w-full resize-none rounded border bg-transparent px-1.5 py-1 text-xs focus:ring-1 focus:outline-none"
					placeholder="Add a note…"
					value={note}
					onChange={(e) => handleNoteChange(e.target.value)}
				/>
			)}
		</li>
	)
}
