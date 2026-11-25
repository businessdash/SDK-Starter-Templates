// [bd-file:blog]
import { el } from "/bd.js";

/** Web, mail and same-site links only, so a post's button can't run script. */
function safeHref(href) {
	return typeof href === "string" && /^(https?:|mailto:|\/|#)/i.test(href) ? href : null;
}

/** The post's call to action, when it has one: a line and a button. */
export function postCta(post) {
	const href = safeHref(post.ctaHref);
	if (!href || !post.ctaLabel) return null;
	return el("aside", { class: "bd-card post__cta" }, [
		post.ctaDescription ? el("p", {}, [post.ctaDescription]) : null,
		el("a", { class: "bd-btn", href }, [post.ctaLabel]),
	]);
}
