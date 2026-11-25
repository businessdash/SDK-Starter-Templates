// [bd-file:blog]
import { error, fail } from '@sveltejs/kit';

import type { Actions, PageServerLoad } from './$types';

import { readingMinutes, safePostHtml } from '#lib/bd/blog.ts';
import {
	getBlogLikes,
	getBlogPost,
	listBlogComments,
	postBlogComment,
	toggleBlogLike
} from '#lib/server/bd-blog.ts';
import { getCustomerSession, SESSION_COOKIE } from '#lib/server/bd-portal.ts';

/**
 * One post: its body (rebuilt safe by `safePostHtml`), likes and comments.
 * Liking and commenting are form actions, so they work before (and without)
 * the page's JavaScript; a signed-out visitor is sent to sign in and back.
 */
export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const result = await getBlogPost(params.slug);
	if (!result) error(404, 'Post not found');
	const token = cookies.get(SESSION_COOKIE) ?? null;
	const [likes, comments, session] = await Promise.all([
		getBlogLikes(params.slug, token),
		listBlogComments(params.slug),
		getCustomerSession(token)
	]);
	const { post, access } = result;
	return {
		post: {
			title: post.title,
			slug: post.slug,
			excerpt: post.excerpt,
			imageUrl: post.imageUrl,
			publishedAt: post.publishedAt,
			authorName: post.authorName,
			authorAvatarUrl: post.authorAvatarUrl,
			tags: post.tags,
			ctaLabel: post.ctaLabel,
			ctaHref: post.ctaHref,
			ctaDescription: post.ctaDescription
		},
		// Only the rebuilt HTML goes to the page, never the raw content.
		html: safePostHtml(post.content),
		minutes: readingMinutes(post.content),
		paywalled: access === 'paywall',
		likes: likes ?? { liked: false, likesCount: post.likes },
		comments: comments.items,
		signedIn: session !== null,
		signInHref: `/my-account?next=${encodeURIComponent(url.pathname)}`,
		url: url.origin + url.pathname
	};
};

export const actions: Actions = {
	like: async ({ params, cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (!token) return fail(401, { like: 'Sign in to like posts.' });
		try {
			return { likes: await toggleBlogLike(params.slug, token) };
		} catch {
			return fail(502, { like: "Couldn't save your like. Try again." });
		}
	},
	comment: async ({ params, cookies, request }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (!token) return fail(401, { comment: 'Sign in to comment.' });
		const content = String((await request.formData()).get('content') ?? '').trim();
		if (!content) return fail(400, { comment: 'Write something first.', content });
		if (content.length > 5000) {
			return fail(400, { comment: 'Comments are up to 5,000 characters.', content });
		}
		try {
			const { approved } = await postBlogComment(params.slug, token, content);
			return {
				posted: approved ? 'Comment posted.' : 'Thanks! Your comment shows once it’s approved.'
			};
		} catch {
			return fail(502, { comment: "Couldn't post your comment. Try again.", content });
		}
	}
};
