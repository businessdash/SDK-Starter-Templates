// [bd-file:blog]
import type { BlogPublicPost } from "@businessdash/sdk/contracts";
import { html, type Raw } from "../../html";
import { formatPostDate, readingMinutes } from "../../shop/blog";

/**
 * A post in the blog's list: cover, Pinned, date and reading time, title,
 * excerpt and author; `lead` draws it large. Returns the list item.
 */
export function postCard(post: BlogPublicPost, { lead = false, blogHref = "/blog" } = {}): Raw {
	return html`<li class="bd-card post-card${lead ? " post-card--lead" : ""}">
		<a class="post-card__link" href="${`${blogHref}/${encodeURIComponent(post.slug)}`}">
			${post.imageUrl ? html`<img alt="" class="post-card__img" loading="lazy" referrerpolicy="no-referrer" src="${post.imageUrl}" />` : ""}
			<div class="post-card__body">
				<p class="post-card__meta">
					${post.isPinned ? html`<span class="bd-badge">Pinned</span>` : ""}
					<span>${formatPostDate(post.publishedAt)}</span>
					<span>· ${String(readingMinutes(post.content || post.excerpt || ""))} min read</span>
				</p>
				<h2>${post.title}</h2>
				${post.excerpt ? html`<p class="post-card__excerpt">${post.excerpt}</p>` : ""}
				${post.authorName ? html`<p class="post-card__author">${post.authorName}</p>` : ""}
			</div>
		</a>
	</li>`;
}
