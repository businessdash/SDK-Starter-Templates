// [bd-file:blog]
import type { BlogPublicPost } from "@businessdash/sdk/contracts";
import { BdLink } from "../bd-link";
import { formatPostDate, readingMinutes } from "./blog";

/**
 * A post in the list: its photo, Pinned, the date and reading time, the
 * title, the excerpt and the author. `lead` makes it the wide first card.
 */
export function PostCard({
	post,
	lead = false,
}: {
	post: BlogPublicPost;
	lead?: boolean;
}) {
	return (
		<li className={`bd-card post-card${lead ? " post-card--lead" : ""}`}>
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
						{post.isPinned && <span className="bd-badge">Pinned</span>}
						<span>{formatPostDate(post.publishedAt)}</span>
						<span>
							· {readingMinutes(post.content || post.excerpt || "")} min read
						</span>
					</p>
					<h2>{post.title}</h2>
					{post.excerpt && <p className="post-card__excerpt">{post.excerpt}</p>}
					{post.authorName && (
						<p className="post-card__author">{post.authorName}</p>
					)}
				</div>
			</BdLink>
		</li>
	);
}
