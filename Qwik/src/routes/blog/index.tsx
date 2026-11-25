// [bd-file:blog]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import type { BlogCategory, BlogPublicPost } from "@businessdash/sdk/contracts";

import { BlogFilters } from "../../components/bd/blog/BlogFilters";
import { PostCard } from "../../components/bd/blog/PostCard";
import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { getBd } from "../../lib/bd";
import { getCustomerSession } from "../../lib/bd-portal";

const PAGE = 12;

/**
 * The blog: posts newest first (pinned ones lead), filtered by category or
 * tag, with "Older posts" paging. Filters live in the URL (?category, ?tag,
 * ?cursor) and the loader reads the posts on the server. A tag is matched
 * here, over the newest 50 posts, because the API filters by category only.
 * The page is laid out from the blog's parts (src/components/bd/blog/):
 * BlogFilters and a PostCard per post.
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

				<BlogFilters categories={categories} category={categoryId} tag={tag} tags={tags} />

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
								<PostCard key={post.id} lead={i === 0 && !paged} post={post} />
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
