import { env } from './env'

const API_URL = env.VITE_API_URL

export interface Sentence {
	id: string
	text: string
	cleanedText?: string
	paragraph: number
}

export interface Page {
	page: number
	text: string
	sentences: Sentence[]
}

export async function computeSha256(file: File): Promise<string> {
	const buffer = await file.arrayBuffer()
	const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

export async function uploadDocument(file: File, docId: string, authToken: string): Promise<{ doc_id: string }> {
	const form = new FormData()
	form.append('file', file)
	form.append('doc_id', docId)
	form.append('filename', file.name)

	const res = await fetch(`${API_URL}/api/upload`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${authToken}` },
		body: form,
	})
	if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
	return res.json()
}

export async function llmCleanDocument(documentId: string, authToken: string): Promise<void> {
	const res = await fetch(`${API_URL}/api/llm-clean`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
		body: JSON.stringify({ document_id: documentId }),
	})
	if (!res.ok) throw new Error(`LLM clean failed: ${res.statusText}`)
}

export async function retryUpload(documentId: string, authToken: string): Promise<void> {
	const res = await fetch(`${API_URL}/api/retry`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${authToken}`,
		},
		body: JSON.stringify({ document_id: documentId }),
	})
	if (!res.ok) throw new Error(`Retry failed: ${res.statusText}`)
}
