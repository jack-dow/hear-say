import { motion, AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'

import { TextMorph } from '@/components/ui/text-morph'
import { cn } from '@/lib/utils'

const STEPS = [
	{ key: null, label: 'Uploading' },
	{ key: 'converting', label: 'Extracting pages' },
	{ key: 'ocr', label: 'Running OCR' },
	{ key: 'cleaning', label: 'Cleaning text' },
	{ key: 'done', label: 'Ready' },
] as const

interface Props {
	currentStep?: string | null
	isRetrying?: boolean
	retryCount?: number
}

function formatElapsed(seconds: number) {
	if (seconds < 60) return `${seconds}s`
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function ProcessingSteps({ currentStep, isRetrying, retryCount }: Props) {
	const activeIndex = STEPS.findIndex((s) => s.key === (currentStep ?? null))
	const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex

	const [stepStartTimes, setStepStartTimes] = useState<Partial<Record<number, number>>>({})
	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		setStepStartTimes((prev) => {
			if (prev[safeActiveIndex] != null) return prev
			return { ...prev, [safeActiveIndex]: Date.now() }
		})
	}, [safeActiveIndex])

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: 'easeOut' }}
			className="flex flex-col items-start gap-0"
		>
			{STEPS.map((step, index) => {
				const isDone = index < safeActiveIndex
				const isActive = index === safeActiveIndex
				const isPending = index > safeActiveIndex
				const isLast = index === STEPS.length - 1

				const startTime = stepStartTimes[index]
				const nextStartTime = stepStartTimes[index + 1]
				const elapsedSeconds =
					isActive && startTime != null
						? Math.floor((now - startTime) / 1000)
						: isDone && startTime != null && nextStartTime != null
							? Math.floor((nextStartTime - startTime) / 1000)
							: null

				return (
					<motion.div
						key={step.label}
						initial={{ opacity: 0, x: -6 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: index * 0.07, duration: 0.3, ease: 'easeOut' }}
						className="flex items-start gap-4"
					>
						{/* Left: circle + connector line */}
						<div className="flex flex-col items-center">
							{/* Circle */}
							<div className="relative flex size-7 items-center justify-center">
								{/* Pulse ring for active step */}
								{isActive && (
									<motion.div
										className="bg-foreground/10 absolute inset-0 rounded-full"
										animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
										transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
									/>
								)}

								{/* Circle background */}
								<motion.div
									className={cn(
										'flex size-5 items-center justify-center rounded-full border transition-colors duration-300',
										isDone && 'border-foreground bg-foreground',
										isActive && 'border-foreground bg-transparent',
										isPending && 'border-muted-foreground/30 bg-transparent',
									)}
									animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
									transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
								>
									<AnimatePresence mode="wait">
										{isDone && (
											<motion.svg
												key="check"
												viewBox="0 0 12 12"
												fill="none"
												className="size-3"
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												transition={{ duration: 0.2 }}
											>
												<motion.path
													d="M2 6l3 3 5-5"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													className="text-background"
													initial={{ pathLength: 0 }}
													animate={{ pathLength: 1 }}
													transition={{ duration: 0.3, ease: 'easeOut' }}
												/>
											</motion.svg>
										)}
										{isActive && (
											<motion.div
												key="dot"
												className="bg-foreground size-1.5 rounded-full"
												initial={{ scale: 0 }}
												animate={{ scale: 1 }}
												exit={{ scale: 0 }}
												transition={{ duration: 0.2 }}
											/>
										)}
									</AnimatePresence>
								</motion.div>
							</div>

							{/* Connector line */}
							{!isLast && (
								<div className="bg-muted-foreground/20 relative my-0.5 h-6 w-px">
									<motion.div
										className="bg-foreground absolute inset-x-0 top-0 w-px origin-top"
										initial={{ scaleY: 0 }}
										animate={{ scaleY: isDone ? 1 : 0 }}
										transition={{ duration: 0.4, ease: 'easeInOut' }}
									/>
								</div>
							)}
						</div>

						{/* Right: label */}
						<div className={cn('pb-6', isLast && 'pb-0')}>
							<p
								className={cn(
									'mt-0.5 text-sm transition-colors duration-300',
									isDone && 'text-muted-foreground',
									isActive && 'text-foreground font-medium',
									isPending && 'text-muted-foreground/40',
								)}
							>
								{isActive && isRetrying ? `Retrying… (attempt ${retryCount} of 3)` : step.label}
								{elapsedSeconds != null && elapsedSeconds >= 0 && (
									<TextMorph as="span" className="text-muted-foreground/60 ml-1.5 font-normal">
										{`· ${formatElapsed(elapsedSeconds)}`}
									</TextMorph>
								)}
							</p>
						</div>
					</motion.div>
				)
			})}
		</motion.div>
	)
}
