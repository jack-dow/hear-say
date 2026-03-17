import * as React from 'react'

import { Spinner } from '@/components/ui/spinner'

interface Props {
	isReady: boolean
	progress: { loaded: number; total: number } | null
}

export function ModelLoader({ isReady, progress }: Props) {
	if (isReady) return null

	const percent = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null

	const loadedMB = progress ? (progress.loaded / 1024 / 1024).toFixed(0) : null
	const totalMB = progress ? (progress.total / 1024 / 1024).toFixed(0) : null

	return (
		<div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky bottom-0 border-t px-6 py-3 backdrop-blur">
			<div className="mx-auto flex max-w-3xl items-center gap-3">
				<Spinner className="text-muted-foreground size-4 shrink-0" />
				<div className="flex flex-1 flex-col gap-1">
					<p className="text-muted-foreground text-xs">
						{percent !== null ? `Loading voice model… ${loadedMB}MB / ${totalMB}MB` : 'Loading voice model…'}
					</p>
					{percent !== null && (
						<div className="bg-muted h-1 w-full overflow-hidden rounded-full">
							<div
								className="bg-primary h-full rounded-full transition-all duration-300"
								style={{ width: `${percent}%` }}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
