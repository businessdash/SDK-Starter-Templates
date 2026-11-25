// [bd-file:blog]
import { html, type Raw } from "../../html";
import { formatPostDate } from "../../shop/blog";

/** The author (photo and name), the date and the reading time. */
export function postMeta(
	post: { authorAvatarUrl?: string | null; authorName?: string | null; publishedAt: string | null },
	minutes: number,
): Raw {
	return html`<p class="post__meta">
		${post.authorAvatarUrl ? html`<img alt="" referrerpolicy="no-referrer" src="${post.authorAvatarUrl}" />` : ""}
		${post.authorName ? html`<span>${post.authorName}</span>` : ""}
		<span>${formatPostDate(post.publishedAt)}</span>
		<span>· ${String(minutes)} min read</span>
	</p>`;
}
