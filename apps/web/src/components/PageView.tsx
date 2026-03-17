import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

import { Tooltip, TooltipTrigger, TooltipPopup } from '@/components/ui/tooltip'
import type { Page } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props {
	pages: Page[]
	activeSentenceId: string | null
	onSentenceClick: (id: string) => void
}

export function PageView({ pages, activeSentenceId, onSentenceClick }: Props) {
	const activeRef = React.useRef<HTMLSpanElement>(null)

	React.useEffect(() => {
		activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [activeSentenceId])

	return (
		<div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
			{pages.map((page) => {
				const paragraphs = groupByParagraph(page)
				return (
					<section key={page.page} data-page={page.page}>
						<p className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">Page {page.page}</p>
						<div className="space-y-4 text-base leading-relaxed">
							{paragraphs.map((sentences, pIdx) => (
								<div key={pIdx}>
									{sentences.map((s) => {
										const displayText = s.cleanedText ?? s.text
										const trivial = isTrivial(displayText)
										const inlineTokens = s.cleanedText ? diffTokens(s.text, s.cleanedText) : null
										const span = (
											<span
												ref={activeSentenceId === s.id ? activeRef : null}
												id={s.id}
												className={cn(
													'cursor-pointer rounded px-0.5 transition-colors',
													trivial ? 'opacity-40' : activeSentenceId === s.id ? 'text-foreground' : 'hover:bg-muted',
												)}
												style={
													activeSentenceId === s.id
														? { backgroundColor: 'color-mix(in srgb, var(--highlight-color) 35%, transparent)' }
														: undefined
												}
												onClick={() => onSentenceClick(s.id)}
											>
												{inlineTokens ? (
													inlineTokens.map((tok, i) =>
														tok.removed ? (
															<span key={i} className="text-muted-foreground/40" aria-hidden="true">
																{tok.text}{' '}
															</span>
														) : (
															<span key={i}>{tok.text} </span>
														),
													)
												) : (
													<ReactMarkdown
														remarkPlugins={[remarkGfm]}
														rehypePlugins={[rehypeRaw]}
														components={{ p: ({ children }) => <>{children}</> }}
													>
														{displayText}
													</ReactMarkdown>
												)}{' '}
											</span>
										)
										return trivial ? (
											<Tooltip key={s.id}>
												<TooltipTrigger render={() => span} />
												<TooltipPopup>TTS will skip — too short to read</TooltipPopup>
											</Tooltip>
										) : (
											<React.Fragment key={s.id}>{span}</React.Fragment>
										)
									})}
								</div>
							))}
						</div>
					</section>
				)
			})}
		</div>
	)
}

function isTrivial(text: string) {
	return text.trim().length < 3
}

/** Inline diff: returns tokens from `raw` tagged as kept or removed vs `clean`. */
function diffTokens(raw: string, clean: string): { text: string; removed: boolean }[] {
	const rawTokens = raw.split(/\s+/).filter(Boolean)
	const cleanTokens = clean.split(/\s+/).filter(Boolean)
	const result: { text: string; removed: boolean }[] = []
	let ci = 0
	for (const token of rawTokens) {
		if (ci < cleanTokens.length && cleanTokens[ci] === token) {
			result.push({ text: token, removed: false })
			ci++
		} else {
			result.push({ text: token, removed: true })
		}
	}
	return result
}

function groupByParagraph(page: Page) {
	const map = new Map<number, typeof page.sentences>()
	for (const s of page.sentences) {
		const group = map.get(s.paragraph) ?? []
		group.push(s)
		map.set(s.paragraph, group)
	}
	return Array.from(map.values())
}
