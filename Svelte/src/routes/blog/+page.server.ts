// [bd-file:blog]
import type { PageServerLoad } from './$types';

import {
	isBlogConfigured,
	listBlogCategories,
	listBlogPosts,
	listBlogTags
} from '#lib/server/bd-blog.ts';

/**
 * The blog index. `?category=<id>` narrows to one category (the API filters),
 * `?tag=<name>` to one tag (filtered here: the API has no tag filter, so a
 * tag shows the matches among the posts loaded), and `?cursor=` pages on.
 */
const PAGE = 12;

export const load: PageServerLoad = async ({ url }) => {
	const categoryId = url.searchParams.get('category') || undefined;
	const tag = url.searchParams.get('tag') || undefined;
	const rawCursor = Number.parseInt(url.searchParams.get('cursor') ?? '', 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;

	if (!isBlogConfigured()) {
		return {
			configured: false,
			posts: [],
			nextCursor: null,
			categories: [],
			tags: [],
			categoryId,
			tag
		};
	}

	const [page, categories, tags] = await Promise.all([
		listBlogPosts({ limit: tag ? 50 : PAGE, cursor, categoryId }),
		listBlogCategories(),
		listBlogTags()
	]);
	const posts = (page?.items ?? []).filter((post) => !tag || post.tags.includes(tag));
	return {
		configured: true,
		// Pinned posts lead the first page.
		posts:
			cursor === null ? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned)) : posts,
		nextCursor: page?.nextCursor ?? null,
		categories,
		tags,
		categoryId,
		tag
	};
};
