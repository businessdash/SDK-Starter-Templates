// [bd-file:blog]
import { html, type Raw } from "../../html";

/** Only web, mail, same-site and in-page links; anything else goes nowhere. */
function safeHref(href: string): string {
	return /^(https?:|mailto:|\/|#)/i.test(href.trim()) ? href.trim() : "#";
}

/** The post's call to action, when it has one: a line and a button. */
export function postCta(post: { ctaHref?: string | null; ctaLabel?: string | null; ctaDescription?: string | null }): Raw {
	if (!post.ctaHref || !post.ctaLabel) return html``;
	return html`<aside class="bd-card post__cta">
		${post.ctaDescription ? html`<p>${post.ctaDescription}</p>` : ""}
		<a class="bd-btn" href="${safeHref(post.ctaHref)}">${post.ctaLabel}</a>
	</aside>`;
}
