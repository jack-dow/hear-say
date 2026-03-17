import { SpinnerGapIcon } from '@phosphor-icons/react'
import type React from 'react'

import { cn } from '@/lib/utils'

export function Spinner({ className, ...props }: React.ComponentProps<typeof SpinnerGapIcon>): React.ReactElement {
	return (
		<SpinnerGapIcon weight="thin" aria-label="Loading" className={cn('animate-spin', className)} role="status" {...props} />
	)
}
