import type { Sentence } from '@/lib/api'
import TtsWorker from '@/workers/tts.worker?worker'

type SentenceChangeCallback = (sentenceId: string) => void
type EndCallback = () => void

async function detectWebGPU(): Promise<boolean> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const gpu = (navigator as any).gpu
	if (!gpu) return false
	try {
		return !!(await gpu.requestAdapter())
	} catch {
		return false
	}
}

export class AudioQueue {
	private sentences: Sentence[] = []
	private currentIndex = 0
	private cache = new Map<string, AudioBuffer>()
	private pendingFetches = new Map<string, Promise<AudioBuffer>>()
	private pendingResolvers = new Map<string, (buf: AudioBuffer) => void>()
	private worker: Worker | null = null
	private ctx: AudioContext | null = null
	private activeSource: AudioBufferSourceNode | null = null
	private _isPlaying = false
	private prefetchAhead = 4

	private onSentenceChangeCb: SentenceChangeCallback | null = null
	private onEndCb: EndCallback | null = null
	onVoicesChanged: ((voices: string[]) => void) | null = null
	onModelProgress: ((loaded: number, total: number) => void) | null = null
	onModelReady: (() => void) | null = null

	private _voice = 'af_heart'
	speed = 1.0

	get voice() {
		return this._voice
	}
	set voice(v: string) {
		if (v === this._voice) return
		this._voice = v
		// clear cache so sentences regenerate with new voice
		this.cache.clear()
		this.pendingFetches.clear()
		this.pendingResolvers.clear()
		if (this._isPlaying) this.prefetch()
	}

	get isPlaying() {
		return this._isPlaying
	}

	get currentSentenceId(): string | null {
		return this.sentences[this.currentIndex]?.id ?? null
	}

	onSentenceChange(cb: SentenceChangeCallback) {
		this.onSentenceChangeCb = cb
	}

	onEnd(cb: EndCallback) {
		this.onEndCb = cb
	}

	load(sentences: Sentence[], startId?: string) {
		this.sentences = sentences
		const idx = startId ? sentences.findIndex((s) => s.id === startId) : 0
		this.currentIndex = idx >= 0 ? idx : 0
		this.cache.clear()
		this.pendingFetches.clear()
		this.pendingResolvers.clear()
		this.getWorker() // warm up worker eagerly
	}

	private getCtx(): AudioContext {
		if (!this.ctx) this.ctx = new AudioContext()
		return this.ctx
	}

	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new TtsWorker()
			this.worker.onmessage = (e: MessageEvent) => this.handleWorkerMessage(e)
			detectWebGPU().then((hasGpu) => {
				this.worker?.postMessage({ type: 'init', device: hasGpu ? 'webgpu' : 'wasm' })
			})
		}
		return this.worker
	}

	private handleWorkerMessage(e: MessageEvent) {
		const { type, ...data } = e.data
		switch (type) {
			case 'ready':
				this.onVoicesChanged?.(data.voices as string[])
				this.onModelReady?.()
				this.prefetch() // start generating first sentences immediately
				break
			case 'progress':
				this.onModelProgress?.(data.loaded as number, data.total as number)
				break
			case 'audio': {
				const ctx = this.getCtx()
				const float32 = new Float32Array(data.audio as Float32Array)
				const sampleRate = data.sampleRate as number
				const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate)
				audioBuffer.copyToChannel(float32, 0)
				this.cache.set(data.id, audioBuffer)
				this.pendingResolvers.get(data.id)?.(audioBuffer)
				this.pendingResolvers.delete(data.id)
				this.pendingFetches.delete(data.id)
				break
			}
			case 'error':
				console.error('TTS worker error:', data.message)
				// Reject any pending fetch for this id with a silent buffer fallback
				if (data.id) {
					const silent = this.getCtx().createBuffer(1, 1, 24000)
					this.pendingResolvers.get(data.id)?.(silent)
					this.pendingResolvers.delete(data.id)
					this.pendingFetches.delete(data.id)
				}
				break
		}
	}

	private isTrivial(sentence: Sentence): boolean {
		return (sentence.cleanedText ?? sentence.text).trim().length < 3
	}

	private ttsText(sentence: Sentence): string {
		return sentence.cleanedText ?? sentence.text
	}

	private fetchBuffer(sentence: Sentence): Promise<AudioBuffer> {
		if (this.cache.has(sentence.id)) return Promise.resolve(this.cache.get(sentence.id)!)
		if (this.pendingFetches.has(sentence.id)) return this.pendingFetches.get(sentence.id)!
		if (this.isTrivial(sentence)) {
			const silent = this.getCtx().createBuffer(1, 1, 24000)
			this.cache.set(sentence.id, silent)
			return Promise.resolve(silent)
		}

		const p = new Promise<AudioBuffer>((resolve) => {
			this.pendingResolvers.set(sentence.id, resolve)
		})
		this.pendingFetches.set(sentence.id, p)
		this.getWorker().postMessage({
			type: 'generate',
			id: sentence.id,
			text: this.ttsText(sentence),
			voice: this.voice,
			speed: this.speed,
		})
		return p
	}

	private prefetch() {
		for (let i = 0; i <= this.prefetchAhead; i++) {
			const s = this.sentences[this.currentIndex + i]
			if (!s || this.cache.has(s.id) || this.pendingFetches.has(s.id)) continue
			if (this.isTrivial(s)) {
				const silent = this.getCtx().createBuffer(1, 1, 24000)
				this.cache.set(s.id, silent)
				continue
			}
			const p = new Promise<AudioBuffer>((resolve) => {
				this.pendingResolvers.set(s.id, resolve)
			})
			this.pendingFetches.set(s.id, p)
			this.getWorker().postMessage({
				type: 'generate',
				id: s.id,
				text: this.ttsText(s),
				voice: this.voice,
				speed: this.speed,
			})
		}
	}

	async play() {
		if (this._isPlaying) return
		this._isPlaying = true
		await this.playCurrentSentence()
	}

	pause() {
		this._isPlaying = false
		this.activeSource?.stop()
		this.activeSource = null
	}

	async next() {
		const wasPlaying = this._isPlaying
		this.pause()
		if (this.currentIndex < this.sentences.length - 1) {
			this.currentIndex++
			this.onSentenceChangeCb?.(this.currentSentenceId!)
		}
		if (wasPlaying) {
			this._isPlaying = true
			await this.playCurrentSentence()
		}
	}

	async prev() {
		const wasPlaying = this._isPlaying
		this.pause()
		if (this.currentIndex > 0) {
			this.currentIndex--
			this.onSentenceChangeCb?.(this.currentSentenceId!)
		}
		if (wasPlaying) {
			this._isPlaying = true
			await this.playCurrentSentence()
		}
	}

	seekTo(sentenceId: string) {
		const idx = this.sentences.findIndex((s) => s.id === sentenceId)
		if (idx < 0) return
		const wasPlaying = this._isPlaying
		this.pause()
		this.currentIndex = idx
		// Clear pending (stale prefetch requests) but keep cache
		this.pendingFetches.clear()
		this.pendingResolvers.clear()
		this.onSentenceChangeCb?.(sentenceId)
		if (wasPlaying) {
			this._isPlaying = true
			this.playCurrentSentence()
		}
	}

	private async playCurrentSentence() {
		const sentence = this.sentences[this.currentIndex]
		if (!sentence) {
			this._isPlaying = false
			this.onEndCb?.()
			return
		}

		this.onSentenceChangeCb?.(sentence.id)
		this.prefetch()

		let buffer: AudioBuffer
		try {
			buffer = await this.fetchBuffer(sentence)
		} catch {
			this._isPlaying = false
			return
		}

		if (!this._isPlaying) return

		const ctx = this.getCtx()
		const source = ctx.createBufferSource()
		source.buffer = buffer
		source.playbackRate.value = this.speed
		source.connect(ctx.destination)
		this.activeSource = source

		source.onended = () => {
			if (!this._isPlaying) return
			this.currentIndex++
			this.playCurrentSentence()
		}

		source.start()
	}

	destroy() {
		this.pause()
		this.worker?.terminate()
		this.worker = null
		this.ctx?.close()
		this.ctx = null
		this.cache.clear()
		this.pendingFetches.clear()
		this.pendingResolvers.clear()
	}
}
