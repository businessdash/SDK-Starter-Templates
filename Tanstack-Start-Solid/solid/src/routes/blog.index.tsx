// [bd-file:blog]
import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { getBlogIndex } from "../lib/bd-blog-fns";
import { formatPostDate, readingMinutes } from "../lib/shop/blog";

/**
 * The blog: posts newest first (pinned ones lead), filtered by category or
 * tag, with "Older posts" paging. The filters live in the URL (?category,
 * ?tag, ?cursor) and the loader reads the posts on the server.
 */
type BlogSearch = { category?: string; tag?: string; cursor?: number };

export const Route = createFileRoute("/blog/")({
	component: BlogIndex,
	validateSearch: (search: Record<string, unknown>): BlogSearch => {
		const cursor = Number(search.cursor);
		return {
			category:
				typeof search.category === "string" && search.category
					? search.category
					: undefined,
			tag:
				typeof search.tag === "string" && search.tag ? search.tag : undefined,
			cursor:
				search.cursor != null && Number.isFinite(cursor) ? cursor : undefined,
		};
	},
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getBlogIndex({ data: deps }),
	head: ({ loaderData, match }) => {
		const active = loaderData?.categories.find(
			(c) => c.id === match.search.category,
		);
		return {
			meta: [
				{ title: active ? `${active.name} · Blog` : "Blog" },
				{
					name: "description",
					content: "News, guides and stories from the team.",
				},
			],
		};
	},
});

function BlogIndex() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const activeCategory = () =>
		data().categories.find((c) => c.id === search().category);
	const paged = () => search().cursor != null;

	/**
	 * This page with one filter changed and the paging reset. The topic
	 * filters are plain links, not <Link>: <Link> sets aria-current itself, to
	 * "page" whenever its search partly matches, so "All" would count as
	 * current on every topic.
	 */
	const filterHref = (key: "category" | "tag", value: string | undefined) => {
		const next: BlogSearch = {
			category: search().category,
			tag: search().tag,
			[key]: value,
		};
		const query = new URLSearchParams();
		if (next.category) query.set("category", next.category);
		if (next.tag) query.set("tag", next.tag);
		const qs = query.toString();
		return qs ? `/blog?${qs}` : "/blog";
	};

	return (
		<main class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Blog</span>
				<h1 class="bd-section__title">
					{activeCategory()?.name ?? "From the blog"}
				</h1>
				<Show when={activeCategory()?.description}>
					<p class="bd-section__sub">{activeCategory()?.description}</p>
				</Show>
			</div>

			<Show when={data().categories.length > 0 || data().tags.length > 0}>
				<nav aria-label="Blog topics" class="blog-filters">
					<Show when={data().categories.length > 0}>
						<ul>
							<li>
								<a
									aria-current={search().category ? undefined : "true"}
									href={filterHref("category", undefined)}
								>
									All
								</a>
							</li>
							<For each={data().categories}>
								{(category) => (
									<li>
										<a
											aria-current={
												search().category === category.id ? "true" : undefined
											}
											href={filterHref("category", category.id)}
										>
											{category.name}
										</a>
									</li>
								)}
							</For>
						</ul>
					</Show>
					<Show when={data().tags.length > 0}>
						<ul class="blog-filters__tags">
							<For each={data().tags}>
								{(t) => (
									<li>
										<a
											aria-current={search().tag === t ? "true" : undefined}
											href={filterHref(
												"tag",
												search().tag === t ? undefined : t,
											)}
										>
											#{t}
										</a>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</nav>
			</Show>

			<Show
				when={data().posts.length > 0}
				fallback={
					<div class="bd-empty">
						{search().tag || search().category
							? "No posts here yet."
							: "No posts published yet. Write one in Business Dash and it'll appear here."}
					</div>
				}
			>
				<ul class="posts">
					<For each={data().posts}>
						{(post, i) => (
							<li
								class={`bd-card post-card${i() === 0 && !paged() ? " post-card--lead" : ""}`}
							>
								<Link
									class="post-card__link"
									params={{ slug: post.slug }}
									to="/blog/$slug"
								>
									<Show when={post.imageUrl}>
										<img
											alt=""
											class="post-card__img"
											loading="lazy"
											referrerpolicy="no-referrer"
											src={post.imageUrl ?? ""}
										/>
									</Show>
									<div class="post-card__body">
										<p class="post-card__meta">
											<Show when={post.isPinned}>
												<span class="bd-badge">Pinned</span>
											</Show>
											<span>{formatPostDate(post.publishedAt)}</span>
											<span>
												· {readingMinutes(post.content || post.excerpt || "")}{" "}
												min read
											</span>
										</p>
										<h2>{post.title}</h2>
										<Show when={post.excerpt}>
											<p class="post-card__excerpt">{post.excerpt}</p>
										</Show>
										<Show when={post.authorName}>
											<p class="post-card__author">{post.authorName}</p>
										</Show>
									</div>
								</Link>
							</li>
						)}
					</For>
				</ul>
				<Show when={data().nextCursor != null}>
					<p class="posts__more">
						<Link
							class="bd-btn bd-btn--ghost"
							search={{
								category: search().category,
								cursor: data().nextCursor ?? undefined,
							}}
							to="/blog"
						>
							Older posts
						</Link>
					</p>
				</Show>
			</Show>
		</main>
	);
}
