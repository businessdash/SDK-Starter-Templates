// [bd-file:blog]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import type { BlogCategory, BlogPublicPost } from "@businessdash/sdk/contracts";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { getBd } from "../../lib/bd";
import { getCustomerSession } from "../../lib/bd-portal";
import { formatPostDate, readingMinutes } from "../../lib/shop/blog";

const PAGE = 12;

/**
 * The blog: posts newest first (pinned ones lead), filtered by category or
 * tag, with "Older posts" paging. Filters live in the URL (?category, ?tag,
 * ?cursor) and the loader reads the posts on the server. A tag is matched
 * here, over the newest 50 posts, because the API filters by category only.
 */
export const useBlogIndex = routeLoader$(async ({ cookie, query }) => {
	const categoryId = query.get("category") || "";
	const tag = query.get("tag") || "";
	const rawCursor = Number.parseInt(query.get("cursor") ?? "", 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;
	const bd = getBd();
	const session = await getCustomerSession(cookie);
	const empty = {
		posts: [] as BlogPublicPost[],
		nextCursor: null as number | null,
		categories: [] as BlogCategory[],
		tags: [] as string[],
	};
	const filters = { categoryId, tag, paged: cursor !== null, signedIn: !!session };
	if (!bd) return { ...empty, ...filters };

	const [page, categories, tags] = await Promise.all([
		bd.blog
			.listPosts({ limit: tag ? 50 : PAGE, cursor, categoryId: categoryId || undefined })
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
	const posts = page.items.filter((post) => !tag || post.tags.includes(tag));
	return {
		posts: cursor === null ? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned)) : posts,
		nextCursor: tag ? null : page.nextCursor,
		categories,
		tags,
		...filters,
	};
});

/** This page with one filter changed and the paging reset. */
function filterHref(current: { categoryId: string; tag: string }, key: "category" | "tag", value: string | null): string {
	const params = new URLSearchParams();
	if (current.categoryId) params.set("category", current.categoryId);
	if (current.tag) params.set("tag", current.tag);
	if (value) params.set(key, value);
	else params.delete(key);
	const qs = params.toString();
	return qs ? `/blog?${qs}` : "/blog";
}

export default component$(() => {
	const data = useBlogIndex();
	const { posts, categories, tags, categoryId, tag, paged, nextCursor } = data.value;
	const activeCategory = categories.find((c) => c.id === categoryId);
	const olderHref = (() => {
		if (nextCursor === null) return null;
		const params = new URLSearchParams();
		if (categoryId) params.set("category", categoryId);
		params.set("cursor", String(nextCursor));
		return `/blog?${params.toString()}`;
	})();

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Blog</span>
					<h1 class="bd-section__title">{activeCategory?.name ?? "From the blog"}</h1>
					{activeCategory?.description ? <p class="bd-section__sub">{activeCategory.description}</p> : null}
				</div>

				{categories.length > 0 || tags.length > 0 ? (
					<nav aria-label="Blog topics" class="blog-filters">
						{categories.length > 0 ? (
							<ul>
								<li>
									<Link aria-current={categoryId ? undefined : "true"} href={filterHref({ categoryId, tag }, "category", null)}>
										All
									</Link>
								</li>
								{categories.map((category) => (
									<li key={category.id}>
										<Link
											aria-current={categoryId === category.id ? "true" : undefined}
											href={filterHref({ categoryId, tag }, "category", category.id)}
										>
											{category.name}
										</Link>
									</li>
								))}
							</ul>
						) : null}
						{tags.length > 0 ? (
							<ul class="blog-filters__tags">
								{tags.map((t) => (
									<li key={t}>
										<Link
											aria-current={tag === t ? "true" : undefined}
											href={filterHref({ categoryId, tag }, "tag", tag === t ? null : t)}
										>
											#{t}
										</Link>
									</li>
								))}
							</ul>
						) : null}
					</nav>
				) : null}

				{posts.length === 0 ? (
					<div class="bd-empty">
						{tag || categoryId
							? "No posts here yet."
							: "No posts published yet. Write one in Business Dash and it'll appear here."}
					</div>
				) : (
					<>
						<ul class="posts">
							{posts.map((post, i) => (
								<li class={`bd-card post-card${i === 0 && !paged ? " post-card--lead" : ""}`} key={post.id}>
									<Link class="post-card__link" href={`/blog/${encodeURIComponent(post.slug)}`}>
										{post.imageUrl ? (
											<img alt="" class="post-card__img" loading="lazy" referrerPolicy="no-referrer" src={post.imageUrl} />
										) : null}
										<div class="post-card__body">
											<p class="post-card__meta">
												{post.isPinned ? <span class="bd-badge">Pinned</span> : null}
												<span>{formatPostDate(post.publishedAt)}</span>
												<span>· {readingMinutes(post.content || post.excerpt || "")} min read</span>
											</p>
											<h2>{post.title}</h2>
											{post.excerpt ? <p class="post-card__excerpt">{post.excerpt}</p> : null}
											{post.authorName ? <p class="post-card__author">{post.authorName}</p> : null}
										</div>
									</Link>
								</li>
							))}
						</ul>
						{olderHref ? (
							<p class="posts__more">
								<Link class="bd-btn bd-btn--ghost" href={olderHref}>
									Older posts
								</Link>
							</p>
						) : null}
					</>
				)}
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = ({ resolveValue }) => {
	const data = resolveValue(useBlogIndex);
	const active = data.categories.find((c) => c.id === data.categoryId);
	return {
		title: active ? `${active.name} · Blog` : "Blog — Your Business",
		meta: [{ name: "description", content: "News, guides and stories from the team." }],
	};
};
