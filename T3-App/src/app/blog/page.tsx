// [bd-file:blog]
import type { Metadata } from "next";

import { BlogIndex } from "@/app/_components/bd/blog/BlogIndex";
import {
	isBlogConfigured,
	listBlogCategories,
	listBlogPosts,
	listBlogTags,
} from "@/server/lib/bd-blog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog" };

/** Posts on a page. With a tag filter, more are read and filtered here. */
const PAGE = 12;

type Search = Record<string, string | string[] | undefined>;
function one(v: string | string[] | undefined): string | undefined {
	return Array.isArray(v) ? v[0] : v;
}

/**
 * The blog: posts newest first (pinned ones lead the first page), with
 * category and tag filters and "Older posts" paging, all in the URL
 * (?category, ?tag, ?cursor).
 */
export default async function BlogPage({
	searchParams,
}: {
	searchParams: Promise<Search>;
}) {
	const sp = await searchParams;
	const categoryId = one(sp.category) || null;
	const tag = one(sp.tag) || null;
	const rawCursor = Number.parseInt(one(sp.cursor) ?? "", 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;

	if (!isBlogConfigured()) {
		return (
			<div className="bd-empty">
				The blog isn't connected yet. Set <code>BD_API_KEY</code>,{" "}
				<code>BD_SITE_ID</code> and <code>BD_PACKAGE_API_BASE_URL</code>, then
				publish a post in Business Dash.
			</div>
		);
	}

	const [page, categories, tags] = await Promise.all([
		listBlogPosts({
			limit: tag ? 50 : PAGE,
			cursor,
			categoryId: categoryId ?? undefined,
		}),
		listBlogCategories(),
		listBlogTags(),
	]);
	const posts = (page?.items ?? []).filter(
		(post) => !tag || post.tags.includes(tag),
	);

	return (
		<BlogIndex
			categories={categories}
			categoryId={categoryId}
			nextCursor={page?.nextCursor ?? null}
			paged={cursor !== null}
			posts={
				cursor === null
					? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
					: posts
			}
			tag={tag}
			tags={tags}
		/>
	);
}
