// [bd-file:blog]
/**
 * Server functions for the blog: the post list with its filters, and one
 * post. A post's HTML is rebuilt from an allowlist here (`safePostHtml`), so
 * the raw HTML never reaches the browser.
 */
import type {
	BlogCategory,
	BlogLikeResponse,
	BlogPublicComment,
	BlogPublicPost,
} from "@businessdash/sdk/contracts";
import { createServerFn } from "@tanstack/solid-start";

import { getBd } from "./bd";
import { customerSession } from "./bd-server-fns";
import { readingMinutes, safePostHtml } from "./shop/blog";

const SDK_OUTPUT = { output: false } as const;

const PAGE = 12;

export type BlogIndexResult = {
	posts: BlogPublicPost[];
	nextCursor: number | null;
	categories: BlogCategory[];
	tags: string[];
};

/**
 * One page of posts (pinned first on the first page), plus the categories
 * and tags for the filters. A tag is matched here, over the newest 50 posts,
 * because the API filters by category only.
 */
export const getBlogIndex = createServerFn({
	method: "GET",
	strict: SDK_OUTPUT,
})
	.validator(
		(data: { category?: string; tag?: string; cursor?: number }) => data,
	)
	.handler(async ({ data }): Promise<BlogIndexResult> => {
		const bd = getBd();
		if (!bd) return { posts: [], nextCursor: null, categories: [], tags: [] };
		const cursor = data.cursor ?? null;
		const [page, categories, tags] = await Promise.all([
			bd.blog
				.listPosts({
					limit: data.tag ? 50 : PAGE,
					cursor,
					categoryId: data.category || undefined,
				})
				.catch(() => ({ items: [] as BlogPublicPost[], nextCursor: null })),
			bd.blog
				.listCategories()
				.then((res) => res.items)
				.catch(() => [] as BlogCategory[]),
			bd.blog
				.listTags()
				.then((res) => res.items)
				.catch(() => [] as string[]),
		]);
		const posts = page.items.filter(
			(post) => !data.tag || post.tags.includes(data.tag),
		);
		return {
			posts:
				cursor === null
					? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
					: posts,
			nextCursor: data.tag ? null : page.nextCursor,
			categories,
			tags,
		};
	});

export type BlogPostResult =
	| { found: false }
	| {
			found: true;
			post: {
				title: string;
				slug: string;
				excerpt: string | null;
				imageUrl: string | null;
				publishedAt: string | null;
				authorName: string | null;
				authorAvatarUrl: string | null;
				tags: string[];
				ctaLabel: string | null;
				ctaHref: string | null;
				ctaDescription: string | null;
			};
			html: string;
			minutes: number;
			paywalled: boolean;
			likes: BlogLikeResponse;
			comments: BlogPublicComment[];
			signedIn: boolean;
	  };

/** One post, ready to show, with its likes and comments. */
export const getBlogPost = createServerFn({ method: "GET", strict: SDK_OUTPUT })
	.validator((data: { slug: string }) => data)
	.handler(async ({ data }): Promise<BlogPostResult> => {
		const bd = getBd();
		if (!bd) return { found: false };
		const result = await bd.blog.getPost(data.slug).catch(() => null);
		if (!result) return { found: false };
		const session = await customerSession();
		const [likes, comments] = await Promise.all([
			(session ? bd.blog.withSession(session.token) : bd.blog)
				.likeStatus(data.slug)
				.catch(() => null),
			bd.blog
				.listComments(data.slug, { limit: 50 })
				.then((res) => res.items)
				.catch(() => [] as BlogPublicComment[]),
		]);
		const { post, access } = result;
		return {
			found: true,
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
				ctaDescription: post.ctaDescription,
			},
			html: safePostHtml(post.content),
			minutes: readingMinutes(post.content),
			paywalled: access === "paywall",
			likes: likes ?? { liked: false, likesCount: post.likes },
			comments,
			signedIn: session !== null,
		};
	});
