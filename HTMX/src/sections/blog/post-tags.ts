// [bd-file:blog]
import { html, type Raw } from "../../html";

/** The post's tags, each linking to the posts with it. */
export function postTags(tags: string[], { blogHref = "/blog" } = {}): Raw {
	if (tags.length === 0) return html``;
	return html`<ul class="post__tags">${tags.map((t) => html`<li><a href="${`${blogHref}?tag=${encodeURIComponent(t)}`}">#${t}</a></li>`)}</ul>`;
}
