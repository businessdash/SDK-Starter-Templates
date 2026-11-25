// [bd-file:blog]
import type { BlogPublicPost } from "@businessdash/sdk/contracts";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { formatPostDate, readingMinutes } from "../../../lib/shop/blog";

/**
 * A post in the list: cover, Pinned, date and reading time, title, excerpt
 * and author. `lead` makes it the big first card.
 */
export function PostCard(props: { post: BlogPublicPost; lead?: boolean }) {
	const post = () => props.post;
	return (
		<li class={`bd-card post-card${props.lead ? " post-card--lead" : ""}`}>
			<Link
				class="post-card__link"
				params={{ slug: post().slug }}
				to="/blog/$slug"
			>
				<Show when={post().imageUrl}>
					<img
						alt=""
						class="post-card__img"
						loading="lazy"
						referrerpolicy="no-referrer"
						src={post().imageUrl ?? ""}
					/>
				</Show>
				<div class="post-card__body">
					<p class="post-card__meta">
						<Show when={post().isPinned}>
							<span class="bd-badge">Pinned</span>
						</Show>
						<span>{formatPostDate(post().publishedAt)}</span>
						<span>
							· {readingMinutes(post().content || post().excerpt || "")} min
							read
						</span>
					</p>
					<h2>{post().title}</h2>
					<Show when={post().excerpt}>
						<p class="post-card__excerpt">{post().excerpt}</p>
					</Show>
					<Show when={post().authorName}>
						<p class="post-card__author">{post().authorName}</p>
					</Show>
				</div>
			</Link>
		</li>
	);
}
