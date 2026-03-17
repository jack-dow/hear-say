import { ConvexError } from 'convex/values'

export const ERROR_CODES = {
	UNAUTHORIZED: 'UNAUTHORIZED',
	NOT_FOUND: 'NOT_FOUND',
	FORBIDDEN: 'FORBIDDEN',
	INVALID_INPUT: 'INVALID_INPUT',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function throwConvexError(code: ErrorCode, message: string): never {
	throw new ConvexError({ code, message })
}
