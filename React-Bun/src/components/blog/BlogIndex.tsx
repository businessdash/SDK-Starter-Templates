// [bd-file:blog]
import type { BlogCategory, BlogPublicPost } from "@businessdash/sdk/contracts";
import { BdLink } from "../bd-link";
import { formatPostDate, readingMinutes } from "./blog";

/**
 * The blog index: topic filters (categories and tags) and the posts, the
 * first one wide. Everything comes in through props and the filters are
 * links (?category, ?tag, ?cursor), so it renders on the server.
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

	/** This page with one filter changed and the paging reset. */
	function filterHref(key: "category" | "tag", value: string | null): string {
		const params = new URLSearchParams();
		if (categoryId) params.set("category", categoryId);
		if (tag) params.set("tag", tag);
		if (value) params.set(key, value);
		else params.delete(key);
		const query = params.toString();
		return query ? `/blog?${query}` : "/blog";
	}

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

			{(categories.length > 0 || tags.length > 0) && (
				<nav aria-label="Blog topics" className="blog-filters">
					{categories.length > 0 && (
						<ul>
							<li>
								<BdLink
									aria-current={!categoryId}
									href={filterHref("category", null)}
								>
									All
								</BdLink>
							</li>
							{categories.map((category) => (
								<li key={category.id}>
									<BdLink
										aria-current={categoryId === category.id}
										href={filterHref("category", category.id)}
									>
										{category.name}
									</BdLink>
								</li>
							))}
						</ul>
					)}
					{tags.length > 0 && (
						<ul className="blog-filters__tags">
							{tags.map((t) => (
								<li key={t}>
									<BdLink
										aria-current={tag === t}
										href={filterHref("tag", tag === t ? null : t)}
									>
										#{t}
									</BdLink>
								</li>
							))}
						</ul>
					)}
				</nav>
			)}

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
							<li
								className={`bd-card post-card${i === 0 && !paged ? " post-card--lead" : ""}`}
								key={post.id}
							>
								<BdLink className="post-card__link" href={`/blog/${post.slug}`}>
									{post.imageUrl && (
										<img
											alt=""
											className="post-card__img"
											loading="lazy"
											referrerPolicy="no-referrer"
											src={post.imageUrl}
										/>
									)}
									<div className="post-card__body">
										<p className="post-card__meta">
											{post.isPinned && (
												<span className="bd-badge">Pinned</span>
											)}
											<span>{formatPostDate(post.publishedAt)}</span>
											<span>
												· {readingMinutes(post.content || post.excerpt || "")}{" "}
												min read
											</span>
										</p>
										<h2>{post.title}</h2>
										{post.excerpt && (
											<p className="post-card__excerpt">{post.excerpt}</p>
										)}
										{post.authorName && (
											<p className="post-card__author">{post.authorName}</p>
										)}
									</div>
								</BdLink>
							</li>
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
