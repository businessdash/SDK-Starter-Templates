// [bd-file:blog]
import { NODE_ENV } from '$app/env/private';
import type {
	BlogCategory,
	BlogLikeResponse,
	BlogPostBySlugResponse,
	BlogPublicComment,
	BlogPublicPost
} from '@businessdash/sdk/contracts';

import { bd } from '#lib/server/bd.ts';

/**
 * Server-only blog helpers over the SDK's `blog` resource.
 *
 * Reading needs nothing but the site key. Liking and commenting need a
 * signed-in customer: they run as `blog.withSession(token)`, where the token
 * is the `bd_session` cookie the sign-in on /my-account sets, so a comment
 * carries the customer's name and a like counts once per person.
 *
 * Reads return null when BusinessDash isn't configured or the call fails, so
 * the pages render an empty state instead of an error.
 */

function devwarn(label: string, err: unknown): void {
	if (NODE_ENV === 'development') {
		console.warn(`[bd-blog] ${label} failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

export function isBlogConfigured(): boolean {
	return bd !== null;
}

export async function listBlogPosts(input: {
	limit?: number;
	cursor?: number | null;
	categoryId?: string;
}): Promise<{ items: BlogPublicPost[]; nextCursor: number | null } | null> {
	if (!bd) return null;
	try {
		return await bd.blog.listPosts(input);
	} catch (err) {
		devwarn('blog.listPosts', err);
		return null;
	}
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
	if (!bd) return [];
	try {
		return (await bd.blog.listCategories()).items;
	} catch (err) {
		devwarn('blog.listCategories', err);
		return [];
	}
}

export async function listBlogTags(): Promise<string[]> {
	if (!bd) return [];
	try {
		return (await bd.blog.listTags()).items;
	} catch (err) {
		devwarn('blog.listTags', err);
		return [];
	}
}

/** The post, or null when there is no published post at that slug. */
export async function getBlogPost(slug: string): Promise<BlogPostBySlugResponse | null> {
	if (!bd) return null;
	try {
		return await bd.blog.getPost(slug);
	} catch (err) {
		devwarn('blog.getPost', err);
		return null;
	}
}

export async function listBlogComments(
	slug: string,
	limit = 50
): Promise<{ items: BlogPublicComment[]; nextCursor: number | null }> {
	if (!bd) return { items: [], nextCursor: null };
	try {
		return await bd.blog.listComments(slug, { limit });
	} catch (err) {
		devwarn('blog.listComments', err);
		return { items: [], nextCursor: null };
	}
}

/** Likes on a post; `liked` is this customer's own like when signed in. */
export async function getBlogLikes(
	slug: string,
	token: string | null
): Promise<BlogLikeResponse | null> {
	if (!bd) return null;
	try {
		return await (token ? bd.blog.withSession(token) : bd.blog).likeStatus(slug);
	} catch (err) {
		devwarn('blog.likeStatus', err);
		return null;
	}
}

export async function toggleBlogLike(slug: string, token: string): Promise<BlogLikeResponse> {
	if (!bd) throw new Error('BusinessDash is not configured.');
	return bd.blog.withSession(token).toggleLike(slug);
}

/** Returns whether the comment shows now, or waits for the business to approve it. */
export async function postBlogComment(
	slug: string,
	token: string,
	content: string
): Promise<{ approved: boolean }> {
	if (!bd) throw new Error('BusinessDash is not configured.');
	const res = await bd.blog.withSession(token).postComment(slug, { content });
	return { approved: res.moderation.isApproved };
}
