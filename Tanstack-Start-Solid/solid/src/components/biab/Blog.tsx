import { For, Show } from "solid-js";

import type { BlogPost } from "../../lib/biab-server-fns";

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function Blog(props: { posts: BlogPost[] }) {
	return (
		<section class="biab-section" id="blog">
			<div class="biab-section__lead">
				<span class="biab-section__eyebrow">Latest</span>
				<h2 class="biab-section__title">From the blog</h2>
				<p class="biab-section__sub">
					Tips, customer stories, and what we're working on this month.
				</p>
			</div>
			<Show
				when={props.posts.length > 0}
				fallback={
					<div class="biab-empty">
						No blog posts published yet. Add one in BIAB and it'll appear here.
					</div>
				}
			>
				<div class="biab-grid-3">
					<For each={props.posts}>
						{(post) => (
							<a class="biab-card blog-card" href={`/blog/${post.slug}`}>
								<span class="blog-card__meta">
									{formatDate(post.publishedAt)}
								</span>
								<h3>{post.title}</h3>
								<Show when={post.excerpt}>
									<p>{post.excerpt}</p>
								</Show>
							</a>
						)}
					</For>
				</div>
			</Show>
		</section>
	);
}
