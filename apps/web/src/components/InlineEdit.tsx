import * as React from 'react'

import { cn } from '@/lib/utils'

interface Props {
	value: string
	onSave: (value: string) => void
	className?: string
}

export function InlineEdit({ value, onSave, className }: Props) {
	const [editing, setEditing] = React.useState(false)
	const [draft, setDraft] = React.useState(value)
	const [pending, setPending] = React.useState<string | null>(null)
	const inputRef = React.useRef<HTMLInputElement>(null)

	React.useEffect(() => {
		if (pending !== null && value === pending) setPending(null)
	}, [value, pending])

	const start = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDraft(value)
		setEditing(true)
	}

	const commit = () => {
		const trimmed = draft.trim()
		if (trimmed && trimmed !== value) {
			setPending(trimmed)
			onSave(trimmed)
		}
		setEditing(false)
	}

	const cancel = () => {
		setDraft(value)
		setEditing(false)
	}

	React.useEffect(() => {
		if (editing) {
			inputRef.current?.select()
		}
	}, [editing])

	if (editing) {
		return (
			<input
				ref={inputRef}
				value={draft}
				className={cn('min-w-0 flex-1 truncate bg-transparent outline-none', className)}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault()
						commit()
					}
					if (e.key === 'Escape') {
						e.preventDefault()
						cancel()
					}
				}}
				onClick={(e) => e.stopPropagation()}
			/>
		)
	}

	return (
		<div className={cn('min-w-0 flex-1 truncate', className)}>
			<span
				role="button"
				tabIndex={0}
				title="Click to rename"
				className="cursor-text"
				onClick={start}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') start(e as never)
				}}
			>
				{pending ?? value}
			</span>
		</div>
	)
}
