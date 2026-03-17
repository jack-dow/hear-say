import { cn } from '@/lib/utils'

interface Props {
	className?: string
}

export function BarLoader({ className }: Props) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-label="Loading"
			role="status"
			className={cn('shrink-0', className)}
		>
			<rect className="search-bar-anim search-bar-anim-1" x="2" y="6" width="4" height="12" rx="1" />
			<rect className="search-bar-anim search-bar-anim-2" x="10" y="6" width="4" height="12" rx="1" />
			<rect className="search-bar-anim search-bar-anim-3" x="18" y="6" width="4" height="12" rx="1" />
		</svg>
	)
}
