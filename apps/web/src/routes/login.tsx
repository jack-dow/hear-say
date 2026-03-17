import { useAuthActions } from '@convex-dev/auth/react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import * as React from 'react'

import { Button } from '@/components/ui/button'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
	InvalidAccountId: 'Invalid email or password.',
	InvalidSecret: 'Invalid email or password.',
	AccountAlreadyExists: 'An account with this email already exists.',
	PasswordTooShort: 'Password must be at least 8 characters.',
	InvalidPassword: 'Invalid email or password.',
}

function parseAuthError(err: unknown): string {
	if (!(err instanceof Error)) return 'Authentication failed.'
	const code = Object.keys(AUTH_ERROR_MESSAGES).find((k) => err.message.includes(k))
	return AUTH_ERROR_MESSAGES[code ?? ''] ?? err.message
}

export const Route = createFileRoute('/login')({
	component: Login,
})

function Login() {
	const { signIn } = useAuthActions()
	const { isAuthenticated } = useConvexAuth()
	const navigate = useNavigate()
	const [email, setEmail] = React.useState('')
	const [password, setPassword] = React.useState('')
	const [error, setError] = React.useState<string | null>(null)
	const [loading, setLoading] = React.useState(false)

	React.useEffect(() => {
		if (isAuthenticated) navigate({ to: '/' })
	}, [isAuthenticated, navigate])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)
		try {
			await signIn('password', { email, password, flow: 'signIn' })
		} catch (err) {
			setError(parseAuthError(err))
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center px-6">
			<div className="w-full max-w-sm space-y-6">
				<div className="space-y-1">
					<img src="/static/images/logo.png" alt="HearSay" className="mb-2 h-10 w-auto" />
					<p className="text-muted-foreground text-sm">Sign in to continue</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full border px-3 py-2 text-sm outline-none focus-visible:ring-2"
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium">
							Password
						</label>
						<input
							id="password"
							type="password"
							required
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full border px-3 py-2 text-sm outline-none focus-visible:ring-2"
						/>
					</div>

					{error && <p className="text-destructive text-sm">{error}</p>}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? '…' : 'Sign in'}
					</Button>
				</form>

				<p className="text-muted-foreground text-center text-sm">
					Need an account?{' '}
					<Link to="/signup" className="text-foreground font-medium underline-offset-4 hover:underline">
						Sign up
					</Link>
				</p>
			</div>
		</main>
	)
}
