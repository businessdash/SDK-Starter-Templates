// [bd-file:blog]
import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { BlogFilters } from "../components/bd/blog/BlogFilters";
import { PostCard } from "../components/bd/blog/PostCard";
import { getBlogIndex } from "../lib/bd-blog-fns";

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

	// Laid out from the blog's parts (src/components/bd/blog/): the topic
	// filters and a <PostCard> per post.
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

			<BlogFilters
				categories={data().categories}
				category={search().category}
				tag={search().tag}
				tags={data().tags}
			/>

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
						{(post, i) => <PostCard lead={i() === 0 && !paged()} post={post} />}
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
