// [bd-file:blog]
import { BlogIndex } from "../components/blog/BlogIndex";
import { bd } from "../lib/bd";
import { useSearchParams } from "../lib/router";
import { ErrorBox, useApi } from "./ui";

/** Posts on a page. With a tag filter, more are read and filtered here. */
const PAGE = 12;

/**
 * The blog: posts newest first (pinned ones lead the first page), with
 * category and tag filters and "Older posts" paging, all in the URL
 * (?category, ?tag, ?cursor).
 */
export function BlogPage() {
	const params = useSearchParams();
	const categoryId = params.get("category") || null;
	const tag = params.get("tag") || null;
	const rawCursor = Number.parseInt(params.get("cursor") ?? "", 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;

	const { data: page, error } = useApi(
		() => bd.blog.listPosts({ limit: tag ? 50 : PAGE, cursor, categoryId }),
		[categoryId, tag, cursor],
	);
	const { data: categories } = useApi(() => bd.blog.listCategories().catch(() => []), []);
	const { data: tags } = useApi(() => bd.blog.listTags().catch(() => []), []);

	const posts = (page?.items ?? []).filter((post) => !tag || post.tags.includes(tag));
	return (
		<main className="bd-page">
			{error && !page ? (
				<ErrorBox error={error} />
			) : !page ? (
				<p className="bd-loading">Loading posts…</p>
			) : (
				<BlogIndex
					categories={categories ?? []}
					categoryId={categoryId}
					nextCursor={page.nextCursor ?? null}
					paged={cursor !== null}
					posts={cursor === null ? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned)) : posts}
					tag={tag}
					tags={tags ?? []}
				/>
			)}
		</main>
	);
}
