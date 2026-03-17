import { z } from 'zod'

import { ERROR_CODES, throwConvexError } from './errors'
import { zAuthMutation, zAuthQuery, zid } from './utils/builders'

export const listTags = zAuthQuery({
	args: {},
	handler: async (ctx) => {
		return ctx.db
			.query('tags')
			.withIndex('by_user', (q) => q.eq('userId', ctx.userId))
			.collect()
	},
})

export const getTagWithAncestors = zAuthQuery({
	args: { tagId: zid('tags') },
	handler: async (ctx, { tagId }) => {
		const tag = await ctx.db.get(tagId)
		if (!tag || tag.userId !== ctx.userId) {
			throwConvexError(ERROR_CODES.NOT_FOUND, 'Tag not found.')
		}
		if (tag.parentId) {
			const parent = await ctx.db.get(tag.parentId)
			if (parent && parent.userId === ctx.userId) {
				return [parent, tag]
			}
		}
		return [tag]
	},
})

export const createTag = zAuthMutation({
	args: {
		name: z.string().min(1).max(50),
		color: z.string().optional(),
		parentId: zid('tags').optional(),
	},
	handler: async (ctx, { name, color, parentId }) => {
		if (parentId) {
			const parent = await ctx.db.get(parentId)
			if (!parent || parent.userId !== ctx.userId) {
				throwConvexError(ERROR_CODES.NOT_FOUND, 'Parent tag not found.')
			}
			if (parent.parentId) {
				throwConvexError(ERROR_CODES.INVALID_INPUT, 'Max 2 levels of tag nesting.')
			}
		}
		return ctx.db.insert('tags', {
			userId: ctx.userId,
			name: name.trim(),
			color,
			parentId,
		})
	},
})

export const updateTag = zAuthMutation({
	args: {
		tagId: zid('tags'),
		name: z.string().min(1).max(50).optional(),
		color: z.string().optional(),
	},
	handler: async (ctx, { tagId, name, color }) => {
		const tag = await ctx.db.get(tagId)
		if (!tag || tag.userId !== ctx.userId) {
			throwConvexError(ERROR_CODES.FORBIDDEN, 'Not found.')
		}
		await ctx.db.patch(tagId, {
			...(name !== undefined && { name: name.trim() }),
			...(color !== undefined && { color }),
		})
	},
})

export const deleteTag = zAuthMutation({
	args: { tagId: zid('tags') },
	handler: async (ctx, { tagId }) => {
		const tag = await ctx.db.get(tagId)
		if (!tag || tag.userId !== ctx.userId) {
			throwConvexError(ERROR_CODES.FORBIDDEN, 'Not found.')
		}

		const children = await ctx.db
			.query('tags')
			.withIndex('by_user_parent', (q) => q.eq('userId', ctx.userId).eq('parentId', tagId))
			.collect()

		const idsToRemove = new Set([tagId, ...children.map((c) => c._id)])

		const docs = await ctx.db
			.query('documents')
			.withIndex('by_user', (q) => q.eq('userId', ctx.userId))
			.collect()

		for (const doc of docs) {
			if (doc.tagIds?.some((id) => idsToRemove.has(id))) {
				await ctx.db.patch(doc._id, {
					tagIds: (doc.tagIds ?? []).filter((id) => !idsToRemove.has(id)),
				})
			}
		}

		for (const child of children) {
			await ctx.db.delete(child._id)
		}
		await ctx.db.delete(tagId)
	},
})

export const setDocumentTagIds = zAuthMutation({
	args: {
		documentId: zid('documents'),
		tagIds: z.array(zid('tags')),
	},
	handler: async (ctx, { documentId, tagIds }) => {
		const doc = await ctx.db.get(documentId)
		if (!doc || doc.userId !== ctx.userId) {
			throwConvexError(ERROR_CODES.FORBIDDEN, 'Not found.')
		}
		await ctx.db.patch(documentId, { tagIds })
	},
})

/** One-shot migration: converts legacy string tags to Tag records. Run from Convex dashboard. */
export const migrateStringTagsToIds = zAuthMutation({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db
			.query('documents')
			.withIndex('by_user', (q) => q.eq('userId', ctx.userId))
			.collect()

		const allStrings = [...new Set(docs.flatMap((d) => d.tags ?? []))]

		const tagMap = new Map<string, string>()
		for (const name of allStrings) {
			const tagId = await ctx.db.insert('tags', { userId: ctx.userId, name })
			tagMap.set(name, tagId)
		}

		let migratedDocs = 0
		for (const doc of docs) {
			if (doc.tags && doc.tags.length > 0) {
				const tagIds = doc.tags.map((t) => tagMap.get(t)).filter((id): id is string => id !== undefined) as any[]
				await ctx.db.patch(doc._id, { tagIds })
				migratedDocs++
			}
		}

		return { migratedTags: allStrings.length, migratedDocs }
	},
})
