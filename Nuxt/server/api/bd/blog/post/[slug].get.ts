// [bd-file:blog]
import type {
	BlogLikeResponse,
	BlogPublicComment,
} from "@businessdash/sdk/contracts";
import { readingMinutes, safePostHtml } from "#shared/bd/blog";

/**
 * GET /api/bd/blog/post/[slug]
 *
 * One post, ready to show: its body rebuilt from an allowlist by
 * `safePostHtml` (the raw HTML never leaves the server), its likes and
 * comments, and whether the visitor is signed in to like or comment.
 */
export type BlogPostResult = {
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
} | null;

export default defineEventHandler(async (event): Promise<BlogPostResult> => {
	const bd = getBd();
	const slug = getRouterParam(event, "slug");
	if (!bd || !slug) return null;
	const result = await bd.blog.getPost(slug).catch(() => null);
	if (!result) {
		throw createError({ statusCode: 404, statusMessage: "Post not found" });
	}
	const session = await getCustomerSession(event).catch(() => null);
	const [likes, comments] = await Promise.all([
		(session ? bd.blog.withSession(session.token) : bd.blog)
			.likeStatus(slug)
			.catch(() => null),
		bd.blog
			.listComments(slug, { limit: 50 })
			.then((res) => res.items)
			.catch(() => []),
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
