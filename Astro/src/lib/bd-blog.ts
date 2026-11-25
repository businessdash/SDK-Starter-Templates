// [bd-file:blog]
import type {
	BlogCategory,
	BlogLikeResponse,
	BlogPostBySlugResponse,
	BlogPublicComment,
	BlogPublicPost,
} from "@businessdash/sdk/contracts";

import { bd } from "./bd";

/**
 * The blog's SDK calls. Reads degrade to empty (and warn in development), so
 * a missing or failing blog shows an empty state instead of an error page.
 * Liking and commenting need the signed-in customer's session token.
 */

function devwarn(label: string, err: unknown): void {
	if (import.meta.env.DEV) {
		console.warn(
			`[bd-blog] ${label} failed: ${err instanceof Error ? err.message : String(err)}`,
		);
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
		devwarn("blog.listPosts", err);
		return null;
	}
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
	if (!bd) return [];
	try {
		return (await bd.blog.listCategories()).items;
	} catch (err) {
		devwarn("blog.listCategories", err);
		return [];
	}
}

export async function listBlogTags(): Promise<string[]> {
	if (!bd) return [];
	try {
		return (await bd.blog.listTags()).items;
	} catch (err) {
		devwarn("blog.listTags", err);
		return [];
	}
}

export async function getBlogPost(
	slug: string,
): Promise<BlogPostBySlugResponse | null> {
	if (!bd) return null;
	try {
		return await bd.blog.getPost(slug);
	} catch (err) {
		devwarn("blog.getPost", err);
		return null;
	}
}

export async function listBlogComments(
	slug: string,
	limit = 50,
): Promise<{ items: BlogPublicComment[]; nextCursor: number | null }> {
	if (!bd) return { items: [], nextCursor: null };
	try {
		return await bd.blog.listComments(slug, { limit });
	} catch (err) {
		devwarn("blog.listComments", err);
		return { items: [], nextCursor: null };
	}
}

/** Like count, and whether this customer liked it (when signed in). */
export async function getBlogLikes(
	slug: string,
	token: string | null,
): Promise<BlogLikeResponse | null> {
	if (!bd) return null;
	try {
		return await (token ? bd.blog.withSession(token) : bd.blog).likeStatus(
			slug,
		);
	} catch (err) {
		devwarn("blog.likeStatus", err);
		return null;
	}
}

export async function toggleBlogLike(
	slug: string,
	token: string,
): Promise<BlogLikeResponse> {
	if (!bd) throw new Error("BusinessDash is not configured.");
	return bd.blog.withSession(token).toggleLike(slug);
}

export async function postBlogComment(
	slug: string,
	token: string,
	content: string,
): Promise<{ approved: boolean }> {
	if (!bd) throw new Error("BusinessDash is not configured.");
	const res = await bd.blog.withSession(token).postComment(slug, { content });
	return { approved: res.moderation.isApproved };
}
