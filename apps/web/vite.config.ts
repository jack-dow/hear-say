import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [tailwindcss(), tanstackStart(), react()],

	resolve: {
		tsconfigPaths: true,
	},

	optimizeDeps: {
		include: ['react-pdf'],
		exclude: ['kokoro-js', '@huggingface/transformers'],
	},

	worker: {
		format: 'es',
	},
})
