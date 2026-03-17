import { BookmarkIcon, XIcon } from '@phosphor-icons/react'
import { useMutation } from 'convex/react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { api } from '@hearsay/convex/api'
import type { Id } from '@hearsay/convex/dataModel'

const HIGHLIGHT_COLORS = [
	{ label: 'Yellow', value: '#facc15' },
	{ label: 'Green', value: '#4ade80' },
	{ label: 'Blue', value: '#60a5fa' },
	{ label: 'Pink', value: '#f472b6' },
	{ label: 'Orange', value: '#fb923c' },
]

type Annotation = {
	_id: string
	type: 'bookmark' | 'highlight'
	sentenceId: string
	note?: string
	color?: string
}

interface Props {
	open: boolean
	anchor: Element | null
	sentenceId: string | null
	docId: string
	existingBookmark?: Annotation
	existingHighlight?: Annotation
	onClose: () => void
}

export function AnnotationPopover({
	open,
	anchor,
	sentenceId,
	docId,
	existingBookmark,
	existingHighlight,
	onClose,
}: Props) {
	const addAnnotation = useMutation(api.annotations.addAnnotation)
	const removeAnnotation = useMutation(api.annotations.removeAnnotation)
	const updateNote = useMutation(api.annotations.updateAnnotationNote)

	const [note, setNote] = React.useState(existingBookmark?.note ?? '')
	const noteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

	// Sync note when bookmark changes
	React.useEffect(() => {
		setNote(existingBookmark?.note ?? '')
	}, [existingBookmark?._id, existingBookmark?.note])

	const handleHighlightColor = async (color: string) => {
		if (!sentenceId) return
		if (existingHighlight?.color === color) {
			await removeAnnotation({ annotationId: existingHighlight._id as Id<'annotations'> })
		} else {
			await addAnnotation({ docId, type: 'highlight', sentenceId, color })
		}
	}

	const handleBookmarkToggle = async () => {
		if (!sentenceId) return
		if (existingBookmark) {
			await removeAnnotation({ annotationId: existingBookmark._id as Id<'annotations'> })
		} else {
			await addAnnotation({ docId, type: 'bookmark', sentenceId })
		}
	}

	const handleNoteChange = (value: string) => {
		setNote(value)
		if (noteTimer.current) clearTimeout(noteTimer.current)
		if (!existingBookmark || !sentenceId) return
		noteTimer.current = setTimeout(async () => {
			await updateNote({ annotationId: existingBookmark._id as Id<'annotations'>, note: value })
		}, 600)
	}

	return (
		<Popover open={open} onOpenChange={(o) => !o && onClose()}>
			<PopoverContent anchor={anchor ?? undefined} side="top" sideOffset={6} className="w-56 p-3">
				<div className="flex flex-col gap-3">
					{/* Close */}
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground text-xs font-medium">Annotate</span>
						<Button size="icon-sm" variant="ghost" onClick={onClose}>
							<XIcon weight="thin" className="size-3" />
						</Button>
					</div>

					{/* Highlight colors */}
					<div>
						<p className="text-muted-foreground mb-1.5 text-xs">Highlight</p>
						<div className="flex gap-1.5">
							{HIGHLIGHT_COLORS.map(({ label, value }) => (
								<button
									key={value}
									aria-label={label}
									className="ring-offset-background focus-visible:ring-ring size-5 rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
									style={{
										backgroundColor: value,
										boxShadow: existingHighlight?.color === value ? `0 0 0 2px white, 0 0 0 3.5px ${value}` : undefined,
									}}
									onClick={() => handleHighlightColor(value)}
								/>
							))}
						</div>
					</div>

					{/* Bookmark toggle */}
					<div>
						<Button
							size="sm"
							variant={existingBookmark ? 'secondary' : 'outline'}
							className="w-full justify-start gap-2 text-xs"
							onClick={handleBookmarkToggle}
						>
							<BookmarkIcon className="size-3" weight={existingBookmark ? 'fill' : 'thin'} />
							{existingBookmark ? 'Bookmarked' : 'Add bookmark'}
						</Button>
					</div>

					{/* Note (only when bookmarked) */}
					{existingBookmark && (
						<textarea
							className="text-foreground placeholder:text-muted-foreground focus:ring-ring min-h-16 w-full resize-none rounded border bg-transparent px-2 py-1.5 text-xs focus:ring-1 focus:outline-none"
							placeholder="Add a note…"
							value={note}
							onChange={(e) => handleNoteChange(e.target.value)}
						/>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
