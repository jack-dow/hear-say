import { Link } from '@tanstack/react-router'

import { TagColorDot } from '@/components/TagBadge'
import type { Doc } from '@hearsay/convex/dataModel'

type Tag = Doc<'tags'>

const BASE = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors'
const ACTIVE = 'bg-primary text-primary-foreground'
const INACTIVE = 'bg-muted text-muted-foreground hover:bg-muted/80'

export function TagFilterBar({ tags }: { tags: Tag[] }) {
	const rootTags = tags.filter((t) => !t.parentId)
	if (rootTags.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Filter by folder">
			<Link
				to="/"
				activeOptions={{ exact: true }}
				className={`${BASE} ${INACTIVE}`}
				activeProps={{ className: `${BASE} ${ACTIVE}` }}
				inactiveProps={{ className: `${BASE} ${INACTIVE}` }}
			>
				All
			</Link>
			{rootTags.map((tag) => (
				<Link
					key={tag._id}
					to="/tags/$tagId"
					params={{ tagId: tag._id }}
					className={`${BASE} ${INACTIVE}`}
					activeProps={{ className: `${BASE} ${ACTIVE}` }}
					inactiveProps={{ className: `${BASE} ${INACTIVE}` }}
				>
					<TagColorDot color={tag.color} />
					{tag.name}
				</Link>
			))}
		</div>
	)
}
