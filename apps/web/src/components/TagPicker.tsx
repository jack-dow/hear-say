import { PlusIcon } from '@phosphor-icons/react'
import { useMutation } from 'convex/react'
import * as React from 'react'

import { TAG_COLOR_KEYS, TAG_COLORS, TagColorDot, type TagColor } from '@/components/TagBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@hearsay/convex/api'
import type { Doc, Id } from '@hearsay/convex/dataModel'

type Tag = Doc<'tags'>

export function TagPicker({ doc, tags, onClose }: { doc: Doc<'documents'>; tags: Tag[]; onClose: () => void }) {
	const setDocumentTagIds = useMutation(api.tags.setDocumentTagIds)
	const createTag = useMutation(api.tags.createTag)

	const [docTagIds, setDocTagIds] = React.useState<Id<'tags'>[]>(doc.tagIds ?? [])
	const [newTagName, setNewTagName] = React.useState('')
	const [newTagColor, setNewTagColor] = React.useState<TagColor>('blue')
	const [newTagParentId, setNewTagParentId] = React.useState<Id<'tags'> | ''>('')
	const [showCreate, setShowCreate] = React.useState(false)

	const rootTags = tags.filter((t) => !t.parentId)
	const childrenOf = (parentId: Id<'tags'>) => tags.filter((t) => t.parentId === parentId)

	const toggle = (tagId: Id<'tags'>) => {
		const next = docTagIds.includes(tagId) ? docTagIds.filter((id) => id !== tagId) : [...docTagIds, tagId]
		setDocTagIds(next)
		setDocumentTagIds({ documentId: doc._id, tagIds: next })
	}

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		const name = newTagName.trim()
		if (!name) return
		const tagId = await createTag({
			name,
			color: newTagColor,
			parentId: newTagParentId || undefined,
		})
		setNewTagName('')
		setShowCreate(false)
		// Auto-assign to doc
		const next = [...docTagIds, tagId]
		setDocTagIds(next)
		setDocumentTagIds({ documentId: doc._id, tagIds: next })
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogPopup showCloseButton={false} className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Folders</DialogTitle>
					<p className="text-muted-foreground truncate text-sm">{doc.displayName ?? doc.filename}</p>
				</DialogHeader>

				<DialogPanel>
					{tags.length === 0 && !showCreate && (
						<p className="text-muted-foreground text-sm">No folders yet. Create one below.</p>
					)}

					{/* Hierarchical tag list */}
					<div className="space-y-1">
						{rootTags.map((tag) => {
							const children = childrenOf(tag._id)
							return (
								<div key={tag._id} role="group" aria-labelledby={`tag-label-${tag._id}`}>
									<label className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded px-1 py-1">
										<Checkbox checked={docTagIds.includes(tag._id)} onCheckedChange={() => toggle(tag._id)} />
										<TagColorDot color={tag.color} size="md" />
										<span id={`tag-label-${tag._id}`} className="text-sm font-medium">
											{tag.name}
										</span>
									</label>
									{children.map((child) => (
										<label
											key={child._id}
											className="hover:bg-muted ml-6 flex cursor-pointer items-center gap-2.5 rounded px-1 py-1"
										>
											<Checkbox checked={docTagIds.includes(child._id)} onCheckedChange={() => toggle(child._id)} />
											<TagColorDot color={child.color} size="md" />
											<span className="text-sm">{child.name}</span>
										</label>
									))}
								</div>
							)
						})}
					</div>

					{/* Create new tag */}
					{showCreate ? (
						<form onSubmit={handleCreate} className="border-input mt-4 space-y-3 rounded-lg border p-3">
							<p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">New folder</p>

							<Input
								placeholder="Folder name..."
								value={newTagName}
								onChange={(e) => setNewTagName(e.target.value)}
								autoFocus
							/>

							{/* Parent tag selector */}
							{rootTags.length > 0 && (
								<div>
									<label className="text-muted-foreground mb-1.5 block text-xs">Under (optional)</label>
									<select
										value={newTagParentId}
										onChange={(e) => setNewTagParentId(e.target.value as Id<'tags'> | '')}
										className="border-input bg-background focus:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
									>
										<option value="">None (top-level)</option>
										{rootTags.map((t) => (
											<option key={t._id} value={t._id}>
												{t.name}
											</option>
										))}
									</select>
								</div>
							)}

							{/* Color picker */}
							<div>
								<label className="text-muted-foreground mb-1.5 block text-xs">Color</label>
								<div role="radiogroup" aria-label="Tag color" className="flex flex-wrap gap-2">
									{TAG_COLOR_KEYS.map((colorKey) => (
										<button
											key={colorKey}
											type="button"
											role="radio"
											aria-checked={newTagColor === colorKey}
											aria-label={`Tag color: ${colorKey}`}
											onClick={() => setNewTagColor(colorKey)}
											className={`focus-visible:ring-ring size-6 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
												newTagColor === colorKey ? 'ring-ring scale-125 ring-2 ring-offset-2' : 'hover:scale-110'
											}`}
											style={{ backgroundColor: TAG_COLORS[colorKey] }}
										/>
									))}
								</div>
							</div>

							<div className="flex gap-2">
								<Button type="submit" size="sm" disabled={!newTagName.trim()}>
									Create
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => {
										setShowCreate(false)
										setNewTagName('')
									}}
								>
									Cancel
								</Button>
							</div>
						</form>
					) : (
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground mt-3 w-full justify-start"
							onClick={() => setShowCreate(true)}
						>
							<PlusIcon weight="thin" className="size-3.5" />
							New folder
						</Button>
					)}
				</DialogPanel>

				<div className="flex justify-end px-6 pb-4">
					<DialogClose render={<Button variant="ghost" size="sm" />}>Done</DialogClose>
				</div>
			</DialogPopup>
		</Dialog>
	)
}
