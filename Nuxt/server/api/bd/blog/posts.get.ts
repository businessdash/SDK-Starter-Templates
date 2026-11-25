// [bd-file:blog]
import type {
	BlogCategory,
	BlogPublicPost,
} from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/blog/posts?category=&tag=&cursor=
 *
 * The blog index: one page of posts (pinned first on the first page), plus
 * the categories and tags for the filters. A tag is matched here, over the
 * newest 50 posts, because the API filters by category only.
 */
export type BlogIndexResult = {
	posts: BlogPublicPost[];
	nextCursor: number | null;
	categories: BlogCategory[];
	tags: string[];
};

const PAGE = 12;

export default defineEventHandler(async (event): Promise<BlogIndexResult> => {
	const bd = getBd();
	if (!bd) return { posts: [], nextCursor: null, categories: [], tags: [] };
	const query = getQuery(event);
	const categoryId = typeof query.category === "string" && query.category ? query.category : undefined;
	const tag = typeof query.tag === "string" && query.tag ? query.tag : undefined;
	const rawCursor = Number.parseInt(String(query.cursor ?? ""), 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;

	const [page, categories, tags] = await Promise.all([
		bd.blog
			.listPosts({ limit: tag ? 50 : PAGE, cursor, categoryId })
			.catch(() => ({ items: [] as BlogPublicPost[], nextCursor: null })),
		bd.blog
			.listCategories()
			.then((res) => res.items)
			.catch(() => []),
		bd.blog
			.listTags()
			.then((res) => res.items)
			.catch(() => []),
	]);
	const posts = page.items.filter((post) => !tag || post.tags.includes(tag));
	return {
		posts:
			cursor === null
				? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
				: posts,
		nextCursor: tag ? null : page.nextCursor,
		categories,
		tags,
	};
});
