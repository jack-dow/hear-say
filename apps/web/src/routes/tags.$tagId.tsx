import { FileTextIcon, TagIcon, TrashIcon } from '@phosphor-icons/react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import * as React from 'react'

import { InlineEdit } from '@/components/InlineEdit'
import { TagBadge, TagColorDot } from '@/components/TagBadge'
import { TagPicker } from '@/components/TagPicker'
import { BarLoader } from '@/components/ui/bar-loader'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@hearsay/convex/api'
import type { Doc, Id } from '@hearsay/convex/dataModel'

export const Route = createFileRoute('/tags/$tagId')({
	component: TagPage,
})

function TagPage() {
	const navigate = useNavigate()
	const { tagId } = Route.useParams()
	const { isAuthenticated, isLoading } = useConvexAuth()

	const ancestors = useQuery(api.tags.getTagWithAncestors, { tagId: tagId as Id<'tags'> })
	const allTags = useQuery(api.tags.listTags)
	const docs = useQuery(api.documents.listDocuments)
	const renameDocument = useMutation(api.documents.renameDocument)
	const deleteDocument = useMutation(api.documents.deleteDocument)

	const [editingDoc, setEditingDoc] = React.useState<Doc<'documents'> | null>(null)

	React.useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			navigate({ to: '/login' })
		}
	}, [isLoading, isAuthenticated, navigate])

	const currentTag = ancestors?.[ancestors.length - 1]
	const parentTag = ancestors?.length === 2 ? ancestors[0] : null

	const childTags = React.useMemo(() => allTags?.filter((t) => t.parentId === tagId) ?? [], [allTags, tagId])

	// Docs assigned to this tag or any child
	const tagIdsInScope = React.useMemo(() => {
		const ids = new Set<string>([tagId])
		childTags.forEach((c) => ids.add(c._id))
		return ids
	}, [tagId, childTags])

	const filteredDocs = React.useMemo(
		() => docs?.filter((d) => d.tagIds?.some((id) => tagIdsInScope.has(id))) ?? [],
		[docs, tagIdsInScope],
	)

	const tagMap = React.useMemo(() => {
		const m = new Map<string, Doc<'tags'>>()
		allTags?.forEach((t) => m.set(t._id, t))
		return m
	}, [allTags])

	if (isLoading || !currentTag) {
		return (
			<main className="flex min-h-screen items-center justify-center">
				<Spinner className="text-muted-foreground size-8" />
			</main>
		)
	}

	if (!isAuthenticated) return null

	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
			{/* Breadcrumb */}
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
					</BreadcrumbItem>
					{parentTag && (
						<>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink render={<Link to="/tags/$tagId" params={{ tagId: parentTag._id }} />}>
									<span className="inline-flex items-center gap-1.5">
										<TagColorDot color={parentTag.color} />
										{parentTag.name}
									</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
						</>
					)}
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>
							<span className="inline-flex items-center gap-1.5">
								<TagColorDot color={currentTag.color} />
								{currentTag.name}
							</span>
						</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			{/* Sub-tag navigation */}
			{childTags.length > 0 && (
				<section aria-label="Sub-folders">
					<h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">Sub-folders</h2>
					<div className="flex flex-wrap gap-1.5">
						{childTags.map((child) => (
							<Link
								key={child._id}
								to="/tags/$tagId"
								params={{ tagId: child._id }}
								className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
							>
								<TagColorDot color={child.color} />
								{child.name}
							</Link>
						))}
					</div>
				</section>
			)}

			{/* Document list */}
			<section className="space-y-3">
				<h2 className="text-muted-foreground text-sm font-medium tracking-widest uppercase">{currentTag.name}</h2>

				{filteredDocs.length === 0 ? (
					<p className="text-muted-foreground px-3 text-sm">No documents in this folder.</p>
				) : (
					<ul className="space-y-1">
						{filteredDocs.map((doc) => (
							<li key={doc._id} className="group flex items-center gap-1">
								<Link
									className="hover:bg-muted flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm"
									params={{ docId: doc.docId }}
									search={{ view: 'text' }}
									to="/reader/$docId"
								>
									<FileTextIcon weight="thin" className="text-muted-foreground size-4 shrink-0" />
									<InlineEdit
										value={doc.displayName ?? doc.filename}
										onSave={(name) => renameDocument({ documentId: doc._id, displayName: name })}
										className="text-sm"
									/>
									{doc.tagIds && doc.tagIds.length > 0 && (
										<span className="flex shrink-0 items-center gap-1">
											{doc.tagIds.map((tid) => {
												const t = tagMap.get(tid)
												return t ? <TagBadge key={tid} tag={t} /> : null
											})}
										</span>
									)}
									{doc.status === 'processing' && <BarLoader className="text-muted-foreground size-3" />}
									{doc.status === 'processing' && (
										<span className="text-muted-foreground text-xs">
											{doc.retryCount && doc.retryCount > 0
												? `Retry ${doc.retryCount}`
												: ({ converting: 'Extracting', ocr: 'OCR', cleaning: 'Cleaning' }[doc.processingStep ?? ''] ??
													'Uploading')}
										</span>
									)}
								</Link>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Manage folders"
									className="opacity-0 group-hover:opacity-100"
									onClick={() => setEditingDoc(doc)}
								>
									<TagIcon weight="thin" className="text-muted-foreground size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Delete document"
									className="opacity-0 group-hover:opacity-100"
									onClick={() => {
										if (confirm(`Delete "${doc.filename}"?`)) {
											deleteDocument({ documentId: doc._id })
										}
									}}
								>
									<TrashIcon weight="thin" className="text-muted-foreground size-4" />
								</Button>
							</li>
						))}
					</ul>
				)}
			</section>

			{editingDoc && allTags && <TagPicker doc={editingDoc} tags={allTags} onClose={() => setEditingDoc(null)} />}
		</main>
	)
}
