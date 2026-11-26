// [bd-file:blog]
import { Link } from "@builder.io/qwik-city";

import type { BlogPublicPost } from "@businessdash/sdk/contracts";

import { formatPostDate, readingMinutes } from "../../../lib/shop/blog";

/** A post in the list: cover, Pinned, date and reading time, title, excerpt, author. `lead` draws it large. */
export function PostCard({
	post,
	lead = false,
}: {
	post: BlogPublicPost;
	lead?: boolean;
}) {
	return (
		<li class={`bd-card post-card${lead ? " post-card--lead" : ""}`}>
			<Link
				class="post-card__link"
				href={`/blog/${encodeURIComponent(post.slug)}`}
			>
				{post.imageUrl ? (
					<img
						width={1600}
						height={900}
						alt=""
						class="post-card__img"
						loading="lazy"
						referrerPolicy="no-referrer"
						src={post.imageUrl}
					/>
				) : null}
				<div class="post-card__body">
					<p class="post-card__meta">
						{post.isPinned ? <span class="bd-badge">Pinned</span> : null}
						<span>{formatPostDate(post.publishedAt)}</span>
						<span>
							· {readingMinutes(post.content || post.excerpt || "")} min read
						</span>
					</p>
					<h2>{post.title}</h2>
					{post.excerpt ? (
						<p class="post-card__excerpt">{post.excerpt}</p>
					) : null}
					{post.authorName ? (
						<p class="post-card__author">{post.authorName}</p>
					) : null}
				</div>
			</Link>
		</li>
	);
}
