// [bd-file:blog]
import type { BlogCategory, BlogPublicPost } from "@businessdash/sdk/contracts";
import { BdLink } from "../bd-link";
import { BlogFilters } from "./BlogFilters";
import { PostCard } from "./PostCard";

/**
 * The blog index: topic filters (categories and tags) and the posts, the
 * first one wide. Everything comes in through props and the filters are
 * links (?category, ?tag, ?cursor), so it renders on the server.
 *
 * It's built from <BlogFilters> and <PostCard>. Use this whole, or lay
 * them out your own way on your own blog page.
 */
export function BlogIndex({
	posts,
	categories,
	tags,
	categoryId,
	tag,
	nextCursor,
	paged,
}: {
	posts: BlogPublicPost[];
	categories: BlogCategory[];
	tags: string[];
	categoryId: string | null;
	tag: string | null;
	nextCursor: number | null;
	/** True past the first page; the first post is only wide on page one. */
	paged: boolean;
}) {
	const active = categories.find((c) => c.id === categoryId);

	function nextHref(cursor: number): string {
		const params = new URLSearchParams();
		if (categoryId) params.set("category", categoryId);
		params.set("cursor", String(cursor));
		return `/blog?${params}`;
	}

	return (
		<>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Blog</span>
				<h1 className="bd-section__title">{active?.name ?? "From the blog"}</h1>
				{active?.description && (
					<p className="bd-section__sub">{active.description}</p>
				)}
			</div>

			<BlogFilters
				categories={categories}
				categoryId={categoryId}
				tag={tag}
				tags={tags}
			/>

			{posts.length === 0 ? (
				<div className="bd-empty">
					{tag || categoryId
						? "No posts here yet."
						: "No posts published yet. Write one in Business Dash and it'll appear here."}
				</div>
			) : (
				<>
					<ul className="posts">
						{posts.map((post, i) => (
							<PostCard key={post.id} lead={i === 0 && !paged} post={post} />
						))}
					</ul>
					{nextCursor !== null && !tag && (
						<p className="posts__more">
							<BdLink
								className="bd-btn bd-btn--ghost"
								href={nextHref(nextCursor)}
							>
								Older posts
							</BdLink>
						</p>
					)}
				</>
			)}
		</>
	);
}
